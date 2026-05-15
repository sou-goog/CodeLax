"""
train_severity_classifier.py
─────────────────────────────
Fine-tune microsoft/codebert-base for 4-class severity classification.
Optimised for Kaggle T4 (16 GB VRAM).

Expected input: CSV produced by prepare_data.py
  columns: text (str), label (int 0-3)

Labels:
  0 = CRITICAL
  1 = HIGH
  2 = MEDIUM
  3 = LOW

Usage on Kaggle:
  1. Upload findings_dataset.csv and this script to a Kaggle notebook.
  2. Enable GPU accelerator (T4 x1 or P100).
  3. Run all cells.

After training, the model is saved to ./severity_classifier/
The inference() function at the bottom shows how to reload it in CodeLax.
"""

# ── Installs (uncomment in Kaggle notebook) ──────────────────────────────────
# !pip install -q transformers datasets evaluate accelerate

import os
import json
import numpy as np
import pandas as pd
from pathlib import Path

import torch
from datasets import Dataset, DatasetDict, ClassLabel
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    TrainingArguments,
    Trainer,
    EarlyStoppingCallback,
    pipeline,
)
import evaluate

# ── Constants ────────────────────────────────────────────────────────────────
MODEL_CHECKPOINT = "microsoft/codebert-base"
OUTPUT_DIR       = "./severity_classifier"
DATA_PATH        = "./findings_dataset.csv"  # output of prepare_data.py

ID2LABEL = {0: "CRITICAL", 1: "HIGH", 2: "MEDIUM", 3: "LOW"}
LABEL2ID = {v: k for k, v in ID2LABEL.items()}
NUM_LABELS = 4

# T4 GPU (16 GB VRAM) optimal settings:
#   batch 8 × grad_accum 4 = effective batch 32
#   fp16 halves memory; fits comfortably on 16 GB
TRAIN_BATCH_SIZE   = 8
EVAL_BATCH_SIZE    = 16
GRAD_ACCUM_STEPS   = 4
LEARNING_RATE      = 2e-5
NUM_EPOCHS         = 6
WARMUP_RATIO       = 0.1
WEIGHT_DECAY       = 0.01
MAX_SEQ_LEN        = 256   # CodeBERT max is 512; 256 covers ~95% of our texts
EVAL_STEPS         = 50
SAVE_STEPS         = 50
TEST_SPLIT_RATIO   = 0.15
VAL_SPLIT_RATIO    = 0.15

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
torch.manual_seed(SEED)
np.random.seed(SEED)

# ── 1. Load & validate data ───────────────────────────────────────────────────

def load_data(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    required = {"text", "label"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"CSV is missing columns: {missing}. Run prepare_data.py first.")
    df = df.dropna(subset=["text", "label"])
    df["label"] = df["label"].astype(int)
    invalid = df[~df["label"].isin(range(NUM_LABELS))]
    if len(invalid):
        print(f"[train] ⚠️  Dropping {len(invalid)} rows with invalid labels.")
        df = df[df["label"].isin(range(NUM_LABELS))]
    print(f"[train] Loaded {len(df)} samples.")
    print(f"[train] Class distribution:\n{df['label'].map(ID2LABEL).value_counts().to_string()}")
    return df


def df_to_hf_dataset(df: pd.DataFrame) -> DatasetDict:
    """Split into train / val / test and convert to HuggingFace DatasetDict."""
    # Stratified split using pandas sample
    test_n  = max(1, int(len(df) * TEST_SPLIT_RATIO))
    val_n   = max(1, int(len(df) * VAL_SPLIT_RATIO))

    test_df  = df.groupby("label", group_keys=False).apply(
        lambda g: g.sample(max(1, int(len(g) * TEST_SPLIT_RATIO)), random_state=SEED)
    )
    remaining = df.drop(test_df.index)
    val_df   = remaining.groupby("label", group_keys=False).apply(
        lambda g: g.sample(max(1, int(len(g) * VAL_SPLIT_RATIO / (1 - TEST_SPLIT_RATIO))), random_state=SEED)
    )
    train_df = remaining.drop(val_df.index)

    print(f"[train] Split → train={len(train_df)}, val={len(val_df)}, test={len(test_df)}")

    def to_dataset(frame: pd.DataFrame) -> Dataset:
        return Dataset.from_dict({
            "text":  frame["text"].tolist(),
            "label": frame["label"].tolist(),
        })

    return DatasetDict({
        "train": to_dataset(train_df),
        "val":   to_dataset(val_df),
        "test":  to_dataset(test_df),
    })


# ── 2. Tokenisation ───────────────────────────────────────────────────────────

def get_tokenizer():
    return AutoTokenizer.from_pretrained(MODEL_CHECKPOINT)


def tokenize(examples, tokenizer):
    return tokenizer(
        examples["text"],
        truncation=True,
        padding="max_length",
        max_length=MAX_SEQ_LEN,
    )


# ── 3. Metrics ────────────────────────────────────────────────────────────────

accuracy_metric = evaluate.load("accuracy")
f1_metric       = evaluate.load("f1")


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)

    acc = accuracy_metric.compute(predictions=predictions, references=labels)
    f1  = f1_metric.compute(
        predictions=predictions,
        references=labels,
        average="weighted",           # weighted F1 handles class imbalance
        labels=list(range(NUM_LABELS))
    )
    # Per-class F1 for detailed diagnostics
    f1_per_class = f1_metric.compute(
        predictions=predictions,
        references=labels,
        average=None,
        labels=list(range(NUM_LABELS))
    )
    result = {
        "accuracy":  round(acc["accuracy"], 4),
        "f1_weighted": round(f1["f1"], 4),
    }
    for i, score in enumerate(f1_per_class["f1"]):
        result[f"f1_{ID2LABEL[i].lower()}"] = round(score, 4)
    return result


# ── 4. Training ───────────────────────────────────────────────────────────────

def train():
    # Load data
    df      = load_data(DATA_PATH)
    dataset = df_to_hf_dataset(df)

    # Tokeniser
    tokenizer = get_tokenizer()
    tokenized = dataset.map(
        lambda ex: tokenize(ex, tokenizer),
        batched=True,
        remove_columns=["text"],
    )
    tokenized.set_format("torch")

    # Model
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_CHECKPOINT,
        num_labels=NUM_LABELS,
        id2label=ID2LABEL,
        label2id=LABEL2ID,
        ignore_mismatched_sizes=True,
    )

    # Compute class weights for imbalanced data (inverse frequency)
    label_counts = df["label"].value_counts().sort_index()
    total        = len(df)
    class_weights = torch.tensor(
        [total / (NUM_LABELS * count) for count in label_counts],
        dtype=torch.float,
    )
    print(f"[train] Class weights: { {ID2LABEL[i]: round(w.item(), 3) for i, w in enumerate(class_weights)} }")

    # Weighted loss Trainer subclass
    class WeightedTrainer(Trainer):
        def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
            labels  = inputs.pop("labels")
            outputs = model(**inputs)
            logits  = outputs.logits
            loss_fn = torch.nn.CrossEntropyLoss(
                weight=class_weights.to(next(model.parameters()).device)
            )
            loss    = loss_fn(logits, labels)
            return (loss, outputs) if return_outputs else loss

    # Training arguments — T4 optimised
    training_args = TrainingArguments(
        output_dir                  = OUTPUT_DIR,
        num_train_epochs            = NUM_EPOCHS,
        per_device_train_batch_size = TRAIN_BATCH_SIZE,
        per_device_eval_batch_size  = EVAL_BATCH_SIZE,
        gradient_accumulation_steps = GRAD_ACCUM_STEPS,
        learning_rate               = LEARNING_RATE,
        weight_decay                = WEIGHT_DECAY,
        warmup_ratio                = WARMUP_RATIO,
        fp16                        = True,          # T4 supports fp16 natively
        eval_strategy               = "steps",
        save_strategy               = "steps",
        eval_steps                  = EVAL_STEPS,
        save_steps                  = SAVE_STEPS,
        load_best_model_at_end      = True,
        metric_for_best_model       = "f1_weighted",
        greater_is_better           = True,
        logging_dir                 = f"{OUTPUT_DIR}/logs",
        logging_steps               = 10,
        report_to                   = "none",        # disable W&B / TensorBoard on Kaggle
        seed                        = SEED,
        dataloader_num_workers      = 2,
        optim                       = "adamw_torch",
    )

    trainer = WeightedTrainer(
        model            = model,
        args             = training_args,
        train_dataset    = tokenized["train"],
        eval_dataset     = tokenized["val"],
        compute_metrics  = compute_metrics,
        callbacks        = [EarlyStoppingCallback(early_stopping_patience=3)],
    )

    print("\n[train] 🚀 Starting fine-tuning...")
    trainer.train()

    # ── Final evaluation on held-out test set ─────────────────────────────
    print("\n[train] 📊 Final test-set evaluation:")
    test_results = trainer.evaluate(tokenized["test"])
    for k, v in test_results.items():
        print(f"  {k}: {v}")

    # ── Save model + tokeniser ────────────────────────────────────────────
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    # Save label mapping alongside model for easy reload
    meta = {"id2label": ID2LABEL, "label2id": LABEL2ID, "max_seq_len": MAX_SEQ_LEN}
    with open(f"{OUTPUT_DIR}/codelax_meta.json", "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n[train] ✅ Model saved to {OUTPUT_DIR}/")
    print("[train] To reload in CodeLax, use the inference() function below.")
    return test_results


# ── 5. Inference helper (load back into CodeLax) ─────────────────────────────

class SeverityClassifier:
    """
    Thin wrapper for loading the fine-tuned model back into CodeLax.

    Usage in Node.js via a Python sidecar (e.g., via child_process or FastAPI):

        from train_severity_classifier import SeverityClassifier
        clf = SeverityClassifier("./severity_classifier")
        result = clf.predict("SQL Injection via unsanitized email parameter")
        # → {"label": "CRITICAL", "score": 0.97, "all_scores": {...}}
    """

    def __init__(self, model_dir: str = OUTPUT_DIR):
        self._pipe = pipeline(
            task            = "text-classification",
            model           = model_dir,
            tokenizer       = model_dir,
            device          = 0 if torch.cuda.is_available() else -1,
            truncation      = True,
            max_length      = MAX_SEQ_LEN,
            top_k           = None,          # return all class scores
        )
        with open(f"{model_dir}/codelax_meta.json") as f:
            self._meta = json.load(f)
        print(f"[SeverityClassifier] Loaded from {model_dir}")

    def predict(self, text: str) -> dict:
        """
        Predict severity for a single finding text.

        Args:
            text: The concatenated finding text (same format as prepare_data.py)

        Returns:
            {
                "label":      "CRITICAL",   # top prediction
                "score":      0.97,          # confidence (0-1)
                "all_scores": {              # scores for all classes
                    "CRITICAL": 0.97,
                    "HIGH":     0.02,
                    "MEDIUM":   0.01,
                    "LOW":      0.00,
                }
            }
        """
        results = self._pipe(text)[0]       # list of {label, score} dicts
        all_scores = {r["label"]: round(r["score"], 4) for r in results}
        top = max(results, key=lambda r: r["score"])
        return {
            "label":      top["label"],
            "score":      round(top["score"], 4),
            "all_scores": all_scores,
        }

    def predict_batch(self, texts: list[str]) -> list[dict]:
        """Batch inference for multiple findings at once."""
        results_batch = self._pipe(texts)
        output = []
        for results in results_batch:
            all_scores = {r["label"]: round(r["score"], 4) for r in results}
            top = max(results, key=lambda r: r["score"])
            output.append({
                "label":      top["label"],
                "score":      round(top["score"], 4),
                "all_scores": all_scores,
            })
        return output


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # ─── Training run ────────────────────────────────────────────────────────
    results = train()

    # ─── Quick smoke test with the inference helper ──────────────────────────
    print("\n[inference] Smoke test:")
    clf = SeverityClassifier(OUTPUT_DIR)

    test_cases = [
        "[AGENT] security [FILE] api/auth.ts [TITLE] SQL Injection via unsanitized email [DESC] User-supplied email interpolated into SQL string. [FIX] Use parameterized queries.",
        "[AGENT] performance [FILE] api/users.ts [TITLE] N+1 query in user list [DESC] Each user triggers a separate SELECT. [FIX] prisma.user.findMany({ include: { profile: true } })",
        "[AGENT] style [FILE] lib/utils.ts [TITLE] Ambiguous variable name [DESC] Single-letter parameter 'x'. [FIX] Rename to inputPayload.",
    ]
    for t in test_cases:
        pred = clf.predict(t)
        print(f"  [{pred['label']} {pred['score']:.2%}] {t[:80]}...")
