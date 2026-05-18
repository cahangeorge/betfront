import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();
async function main() {
    const users = await prisma.user.findMany({ take: 10, orderBy: { id: 'desc' } });
    console.log(JSON.stringify(users.map(u => ({ id: u.id, email: u.email, name: u.name, hasHash: !!u.passwordHash })), null, 2));
}
main().finally(() => prisma.$disconnect());