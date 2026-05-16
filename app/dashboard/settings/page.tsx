"use client";

import React from 'react'
import ProfileForm from "@/module/settings/actions/components/profile-form";
import { RepositoryList } from "@/module/settings/components/repository-list";
import { ExtensionSettings } from "@/module/settings/components/extension-settings";

const SettingPage = () => {
    return (
        <div className='space-y-8 pb-12'>
            <div>
                <h1 className="text-[40px] font-semibold tracking-tighter text-foreground mb-2">Settings</h1>
                <p className="text-muted-foreground">Manage your account settings and connected repositories.</p>
            </div>
            <ProfileForm />
            <RepositoryList />
            <ExtensionSettings />
        </div>
    )
}

export default SettingPage
