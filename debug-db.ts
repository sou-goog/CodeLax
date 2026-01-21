
import prisma from './lib/db'

async function main() {
  const users = await prisma.user.findMany()
  console.log(`Found ${users.length} users:`, users.map(u => ({ id: u.id, name: u.name, email: u.email })))
  
  const repos = await prisma.repository.findMany()
  console.log(`Found ${repos.length} repositories`)
  
  // Custom replacer for BigInt
  const replacer = (key: string, value: any) => 
    typeof value === 'bigint' ? value.toString() : value

  console.log(JSON.stringify(repos, replacer, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
