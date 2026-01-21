
import prisma from './lib/db'

async function main() {
  const users = await prisma.user.findMany()
  if (users.length === 0) {
    console.log("No users found")
    return
  }
  const user = users[0]
  console.log(`Checking for user: ${user.id} (${user.name})`)

  const repos = await prisma.repository.findMany({
    where: { userId: user.id }
  })
  
  if (repos.length > 0) {
    console.log(`SUCCESS: Found ${repos.length} repositories for this user.`)
    repos.forEach(r => console.log(`- ${r.fullName} (ID: ${r.id})`))
  } else {
    console.log("FAILURE: No repositories found for this user.")
    const allRepos = await prisma.repository.findMany()
    console.log(`Total repos in DB: ${allRepos.length}`)
    if (allRepos.length > 0) {
        console.log(`Sample repo userId: ${allRepos[0].userId}`)
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect())
