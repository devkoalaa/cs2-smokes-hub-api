#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

interface DbCommand {
  name: string;
  description: string;
  action: () => Promise<void>;
}

const commands: DbCommand[] = [
  {
    name: 'reset',
    description: 'Reset database with production seed data',
    action: async () => {
      console.log('🔄 Resetting database with production data...');
      execSync('npm run db:reset', { stdio: 'inherit' });
    },
  },
  {
    name: 'reset-dev',
    description: 'Reset database with development test data',
    action: async () => {
      console.log('🔄 Resetting database with development test data...');
      execSync('npm run db:reset:dev', { stdio: 'inherit' });
    },
  },
  {
    name: 'migrate',
    description: 'Run pending migrations',
    action: async () => {
      console.log('🚀 Running database migrations...');
      execSync('npm run prisma:migrate', { stdio: 'inherit' });
    },
  },
  {
    name: 'migrate-deploy',
    description: 'Deploy migrations (production)',
    action: async () => {
      console.log('🚀 Deploying migrations for production...');
      execSync('npm run prisma:migrate:deploy', { stdio: 'inherit' });
    },
  },
  {
    name: 'seed',
    description: 'Seed database with production data',
    action: async () => {
      console.log('🌱 Seeding database with production data...');
      execSync('npm run prisma:seed', { stdio: 'inherit' });
    },
  },
  {
    name: 'seed-dev',
    description: 'Seed database with development test data',
    action: async () => {
      console.log('🌱 Seeding database with development test data...');
      execSync('npm run prisma:seed:dev', { stdio: 'inherit' });
    },
  },
  {
    name: 'status',
    description: 'Check migration status',
    action: async () => {
      console.log('📊 Checking migration status...');
      execSync('npm run prisma:migrate:status', { stdio: 'inherit' });
    },
  },
  {
    name: 'studio',
    description: 'Open Prisma Studio',
    action: async () => {
      console.log('🎨 Opening Prisma Studio...');
      execSync('npm run prisma:studio', { stdio: 'inherit' });
    },
  },
  {
    name: 'clean',
    description: 'Clean all data (dangerous!)',
    action: async () => {
      console.log('🧹 Cleaning all database data...');
      await prisma.report.deleteMany();
      await prisma.rating.deleteMany();
      await prisma.smoke.deleteMany();
      await prisma.user.deleteMany();
      await prisma.map.deleteMany();
      console.log('✅ All data cleaned successfully');
    },
  },
];

async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log('🗃️  Database Management Tool\n');
    console.log('Available commands:');
    commands.forEach((cmd) => {
      console.log(`  ${cmd.name.padEnd(15)} - ${cmd.description}`);
    });
    console.log('\nUsage: ts-node scripts/db-management.ts <command>');
    console.log('\n📋 Prerequisites:');
    console.log('  1. PostgreSQL server running');
    console.log('  2. DATABASE_URL configured in .env');
    console.log('  3. Database created');
    return;
  }

  const selectedCommand = commands.find((cmd) => cmd.name === command);

  if (!selectedCommand) {
    console.error(`❌ Unknown command: ${command}`);
    console.log('\nAvailable commands:');
    commands.forEach((cmd) => {
      console.log(`  ${cmd.name}`);
    });
    process.exit(1);
  }

  // Check database connection for commands that need it
  const needsConnection = ['clean', 'seed', 'seed-dev'];
  if (needsConnection.includes(command)) {
    console.log('🔍 Checking database connection...');
    const isConnected = await checkDatabaseConnection();
    if (!isConnected) {
      console.error('❌ Cannot connect to database');
      console.log('\n📋 Please ensure:');
      console.log('  1. PostgreSQL server is running');
      console.log('  2. DATABASE_URL is correctly configured in .env');
      console.log('  3. Database exists and is accessible');
      process.exit(1);
    }
    console.log('✅ Database connection successful');
  }

  try {
    await selectedCommand.action();
    console.log('✅ Command completed successfully');
  } catch (error) {
    console.error('❌ Command failed:', error);
    if (error instanceof Error && error.message.includes('P1001')) {
      console.log('\n💡 This appears to be a database connection issue.');
      console.log('   Please check your DATABASE_URL and ensure PostgreSQL is running.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});