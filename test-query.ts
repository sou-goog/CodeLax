
import prisma from './lib/db'

async function main() {
  const users = await prisma.user.findMany()
  if (users.length === 0) return
  const userId = users[0].id

  console.log("Testing query for user:", userId)

  try {
      const repositories = await prisma.repository.findMany({
            where: { userId: userId },
            select: {
                id: true,
                name: true,
                fullName: true,
                url: true,
                description: true,
                language: true,
                stars: true,
                createdAt: true
            },
            orderBy: {
                createdAt: "desc"
            }
        })
    console.log("Query SUCCESS:", JSON.stringify(repositories, null, 2))
  } catch (e) {
    console.error("Query FAILED:", e)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
