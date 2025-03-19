const { PrismaClient } = require('@prisma/client');

let prisma = new PrismaClient();

module.exports = {
  prisma,
  connectToPrisma: async function () {
    await prisma.$connect()
  }
}
