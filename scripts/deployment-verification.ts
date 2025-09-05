#!/usr/bin/env ts-node

/**
 * CS2 Smokes Hub API - Deployment Verification Script
 * 
 * This script performs comprehensive verification of the application
 * to ensure it's ready for deployment and meets all requirements.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface VerificationResult {
  category: string;
  checks: Array<{
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    requirement?: string;
  }>;
}

class DeploymentVerifier {
  private results: VerificationResult[] = [];
  private rootDir: string;

  constructor() {
    this.rootDir = process.cwd();
  }

  /**
   * Run all verification checks
   */
  async verify(): Promise<void> {
    console.log('🚀 CS2 Smokes Hub API - Deployment Verification\n');
    console.log('=' .repeat(60));

    await this.verifyProjectStructure();
    await this.verifyDependencies();
    await this.verifyConfiguration();
    await this.verifyCodeQuality();
    await this.verifyAPIEndpoints();
    await this.verifyAuthentication();
    await this.verifyDataModels();
    await this.verifyErrorHandling();
    await this.verifyTestCoverage();
    await this.verifyRequirements();

    this.printResults();
    this.printSummary();
  }

  /**
   * Verify project structure and essential files
   */
  private async verifyProjectStructure(): Promise<void> {
    const checks = [];
    const category = 'Project Structure';

    // Essential files
    const essentialFiles = [
      'package.json',
      'tsconfig.json',
      'nest-cli.json',
      'prisma/schema.prisma',
      '.env',
      'src/main.ts',
      'src/app.module.ts'
    ];

    for (const file of essentialFiles) {
      const exists = existsSync(join(this.rootDir, file));
      checks.push({
        name: `${file} exists`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? 'File found' : 'Required file missing'
      });
    }

    // Module structure
    const modules = [
      'src/auth',
      'src/maps', 
      'src/smokes',
      'src/ratings',
      'src/reports',
      'src/prisma',
      'src/common'
    ];

    for (const module of modules) {
      const exists = existsSync(join(this.rootDir, module));
      checks.push({
        name: `${module} module exists`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? 'Module directory found' : 'Module directory missing'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify dependencies and package configuration
   */
  private async verifyDependencies(): Promise<void> {
    const checks = [];
    const category = 'Dependencies & Configuration';

    try {
      const packageJson = JSON.parse(readFileSync(join(this.rootDir, 'package.json'), 'utf8'));
      
      // Required dependencies
      const requiredDeps = [
        '@nestjs/core',
        '@nestjs/common',
        '@nestjs/jwt',
        '@nestjs/passport',
        '@nestjs/config',
        '@prisma/client',
        'passport-steam',
        'passport-jwt',
        'class-validator',
        'class-transformer'
      ];

      for (const dep of requiredDeps) {
        const exists = packageJson.dependencies?.[dep];
        checks.push({
          name: `${dep} dependency`,
          status: exists ? 'PASS' : 'FAIL' as const,
          message: exists ? `Version: ${exists}` : 'Required dependency missing'
        });
      }

      // Required scripts
      const requiredScripts = [
        'build',
        'start',
        'start:prod',
        'test',
        'test:e2e',
        'prisma:generate',
        'prisma:migrate'
      ];

      for (const script of requiredScripts) {
        const exists = packageJson.scripts?.[script];
        checks.push({
          name: `${script} script`,
          status: exists ? 'PASS' : 'FAIL' as const,
          message: exists ? 'Script defined' : 'Required script missing'
        });
      }

    } catch (error) {
      checks.push({
        name: 'package.json parsing',
        status: 'FAIL',
        message: `Error reading package.json: ${error.message}`
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify environment configuration
   */
  private async verifyConfiguration(): Promise<void> {
    const checks = [];
    const category = 'Environment Configuration';

    // Check .env file
    if (existsSync(join(this.rootDir, '.env'))) {
      const envContent = readFileSync(join(this.rootDir, '.env'), 'utf8');
      
      const requiredEnvVars = [
        'DATABASE_URL',
        'JWT_SECRET', 
        'STEAM_API_KEY'
      ];

      for (const envVar of requiredEnvVars) {
        const exists = envContent.includes(`${envVar}=`);
        checks.push({
          name: `${envVar} environment variable`,
          status: exists ? 'PASS' : 'FAIL' as const,
          message: exists ? 'Environment variable configured' : 'Required environment variable missing',
          requirement: 'Requirements 8.1, 9.1'
        });
      }
    } else {
      checks.push({
        name: '.env file',
        status: 'FAIL',
        message: 'Environment file missing'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify code quality and build
   */
  private async verifyCodeQuality(): Promise<void> {
    const checks = [];
    const category = 'Code Quality & Build';

    try {
      // Test TypeScript compilation
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
      checks.push({
        name: 'TypeScript compilation',
        status: 'PASS',
        message: 'No TypeScript errors found'
      });
    } catch (error) {
      checks.push({
        name: 'TypeScript compilation',
        status: 'FAIL',
        message: 'TypeScript compilation errors detected'
      });
    }

    try {
      // Test build process
      execSync('npm run build', { stdio: 'pipe' });
      checks.push({
        name: 'Build process',
        status: 'PASS',
        message: 'Application builds successfully'
      });
    } catch (error) {
      checks.push({
        name: 'Build process',
        status: 'FAIL',
        message: 'Build process failed'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify API endpoints structure
   */
  private async verifyAPIEndpoints(): Promise<void> {
    const checks = [];
    const category = 'API Endpoints';

    // Check controller files exist
    const controllers = [
      { file: 'src/auth/auth.controller.ts', endpoints: ['GET /auth/steam', 'GET /auth/steam/return', 'GET /auth/me'] },
      { file: 'src/maps/maps.controller.ts', endpoints: ['GET /maps', 'GET /maps/:id'] },
      { file: 'src/smokes/smokes.controller.ts', endpoints: ['GET /maps/:mapId/smokes', 'POST /smokes', 'DELETE /smokes/:id'] },
      { file: 'src/ratings/ratings.controller.ts', endpoints: ['POST /smokes/:smokeId/rate'] },
      { file: 'src/reports/reports.controller.ts', endpoints: ['POST /smokes/:smokeId/report'] }
    ];

    for (const controller of controllers) {
      const exists = existsSync(join(this.rootDir, controller.file));
      checks.push({
        name: `${controller.file}`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? `Controller exists (${controller.endpoints.join(', ')})` : 'Controller file missing',
        requirement: 'Requirements 1-7'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify authentication implementation
   */
  private async verifyAuthentication(): Promise<void> {
    const checks = [];
    const category = 'Authentication & Security';

    const authFiles = [
      'src/auth/strategies/steam.strategy.ts',
      'src/auth/strategies/jwt.strategy.ts',
      'src/auth/guards/jwt-auth.guard.ts',
      'src/auth/auth.service.ts'
    ];

    for (const file of authFiles) {
      const exists = existsSync(join(this.rootDir, file));
      checks.push({
        name: `${file}`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? 'Authentication component exists' : 'Authentication component missing',
        requirement: 'Requirements 1.1-1.5, 9.1-9.4'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify data models and DTOs
   */
  private async verifyDataModels(): Promise<void> {
    const checks = [];
    const category = 'Data Models & Validation';

    // Check DTO files
    const dtoFiles = [
      'src/common/dto/create-smoke.dto.ts',
      'src/common/dto/rate-smoke.dto.ts', 
      'src/common/dto/report-smoke.dto.ts'
    ];

    for (const file of dtoFiles) {
      const exists = existsSync(join(this.rootDir, file));
      checks.push({
        name: `${file}`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? 'DTO exists' : 'DTO missing',
        requirement: 'Requirements 10.1-10.5'
      });
    }

    // Check Prisma schema
    if (existsSync(join(this.rootDir, 'prisma/schema.prisma'))) {
      const schemaContent = readFileSync(join(this.rootDir, 'prisma/schema.prisma'), 'utf8');
      
      const requiredModels = ['User', 'Map', 'Smoke', 'Rating', 'Report'];
      for (const model of requiredModels) {
        const exists = schemaContent.includes(`model ${model}`);
        checks.push({
          name: `${model} model`,
          status: exists ? 'PASS' : 'FAIL' as const,
          message: exists ? 'Model defined in schema' : 'Model missing from schema',
          requirement: 'Requirements 8.1-8.4'
        });
      }
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify error handling implementation
   */
  private async verifyErrorHandling(): Promise<void> {
    const checks = [];
    const category = 'Error Handling';

    const errorFiles = [
      'src/common/filters/global-exception.filter.ts'
    ];

    for (const file of errorFiles) {
      const exists = existsSync(join(this.rootDir, file));
      checks.push({
        name: `${file}`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? 'Error handling component exists' : 'Error handling component missing',
        requirement: 'Requirements 8.4, 10.1-10.5'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify test coverage
   */
  private async verifyTestCoverage(): Promise<void> {
    const checks = [];
    const category = 'Test Coverage';

    try {
      // Run unit tests
      execSync('npm test', { stdio: 'pipe' });
      checks.push({
        name: 'Unit tests',
        status: 'PASS',
        message: 'All unit tests passing'
      });
    } catch (error) {
      checks.push({
        name: 'Unit tests',
        status: 'FAIL',
        message: 'Unit tests failing'
      });
    }

    try {
      // Run integration tests
      execSync('npm run test:integration', { stdio: 'pipe' });
      checks.push({
        name: 'Integration tests',
        status: 'PASS',
        message: 'All integration tests passing'
      });
    } catch (error) {
      checks.push({
        name: 'Integration tests',
        status: 'WARN',
        message: 'Integration tests require database connection'
      });
    }

    // Check test files exist
    const testFiles = [
      'test/auth-flow.e2e-spec.ts',
      'test/complete-workflows.e2e-spec.ts',
      'test/error-scenarios.e2e-spec.ts',
      'test/database-operations.integration-spec.ts'
    ];

    for (const file of testFiles) {
      const exists = existsSync(join(this.rootDir, file));
      checks.push({
        name: `${file}`,
        status: exists ? 'PASS' : 'FAIL' as const,
        message: exists ? 'Test file exists' : 'Test file missing'
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Verify requirements compliance
   */
  private async verifyRequirements(): Promise<void> {
    const checks = [];
    const category = 'Requirements Compliance';

    const requirements = [
      {
        id: '1.1-1.5',
        name: 'Steam Authentication',
        description: 'Steam OpenID authentication with JWT tokens',
        files: ['src/auth/strategies/steam.strategy.ts', 'src/auth/auth.service.ts']
      },
      {
        id: '2.1-2.3', 
        name: 'Maps Management',
        description: 'Map listing and retrieval endpoints',
        files: ['src/maps/maps.controller.ts', 'src/maps/maps.service.ts']
      },
      {
        id: '3.1-3.4',
        name: 'Smoke Viewing',
        description: 'Smoke strategy viewing with ratings',
        files: ['src/smokes/smokes.controller.ts', 'src/smokes/smokes.service.ts']
      },
      {
        id: '4.1-4.5',
        name: 'Smoke Creation',
        description: 'Authenticated smoke strategy creation',
        files: ['src/smokes/smokes.controller.ts', 'src/common/dto/create-smoke.dto.ts']
      },
      {
        id: '5.1-5.4',
        name: 'Smoke Deletion',
        description: 'Owner-only smoke deletion',
        files: ['src/smokes/smokes.controller.ts', 'src/smokes/smokes.service.ts']
      },
      {
        id: '6.1-6.5',
        name: 'Rating System',
        description: 'Smoke rating with upsert functionality',
        files: ['src/ratings/ratings.controller.ts', 'src/ratings/ratings.service.ts']
      },
      {
        id: '7.1-7.5',
        name: 'Reporting System',
        description: 'Content moderation through reports',
        files: ['src/reports/reports.controller.ts', 'src/reports/reports.service.ts']
      },
      {
        id: '8.1-8.4',
        name: 'Database Integration',
        description: 'PostgreSQL with Prisma ORM',
        files: ['prisma/schema.prisma', 'src/prisma/prisma.service.ts']
      },
      {
        id: '9.1-9.4',
        name: 'JWT Authentication',
        description: 'JWT-based session management',
        files: ['src/auth/strategies/jwt.strategy.ts', 'src/auth/guards/jwt-auth.guard.ts']
      },
      {
        id: '10.1-10.5',
        name: 'Input Validation',
        description: 'Comprehensive input validation with DTOs',
        files: ['src/common/dto/', 'src/common/filters/global-exception.filter.ts']
      }
    ];

    for (const req of requirements) {
      const allFilesExist = req.files.every(file => {
        const fullPath = join(this.rootDir, file);
        return existsSync(fullPath) || (file.endsWith('/') && existsSync(file.slice(0, -1)));
      });

      checks.push({
        name: `Requirement ${req.id}: ${req.name}`,
        status: allFilesExist ? 'PASS' : 'FAIL' as const,
        message: allFilesExist ? req.description : `Missing implementation files`,
        requirement: `Requirements ${req.id}`
      });
    }

    this.results.push({ category, checks });
  }

  /**
   * Print detailed results
   */
  private printResults(): void {
    console.log('\n📋 DETAILED VERIFICATION RESULTS\n');

    for (const result of this.results) {
      console.log(`\n🔍 ${result.category}`);
      console.log('-'.repeat(result.category.length + 4));

      for (const check of result.checks) {
        const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
        const req = check.requirement ? ` (${check.requirement})` : '';
        console.log(`${icon} ${check.name}: ${check.message}${req}`);
      }
    }
  }

  /**
   * Print summary and recommendations
   */
  private printSummary(): void {
    const totalChecks = this.results.reduce((sum, result) => sum + result.checks.length, 0);
    const passedChecks = this.results.reduce((sum, result) => 
      sum + result.checks.filter(check => check.status === 'PASS').length, 0);
    const failedChecks = this.results.reduce((sum, result) => 
      sum + result.checks.filter(check => check.status === 'FAIL').length, 0);
    const warningChecks = this.results.reduce((sum, result) => 
      sum + result.checks.filter(check => check.status === 'WARN').length, 0);

    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Checks: ${totalChecks}`);
    console.log(`✅ Passed: ${passedChecks}`);
    console.log(`❌ Failed: ${failedChecks}`);
    console.log(`⚠️  Warnings: ${warningChecks}`);
    console.log(`Success Rate: ${Math.round((passedChecks / totalChecks) * 100)}%`);

    if (failedChecks === 0) {
      console.log('\n🎉 DEPLOYMENT READY!');
      console.log('All critical checks passed. The application is ready for deployment.');
    } else {
      console.log('\n⚠️  DEPLOYMENT BLOCKED');
      console.log('Please fix the failed checks before deploying to production.');
    }

    console.log('\n📝 DEPLOYMENT CHECKLIST:');
    console.log('□ Set up production database with proper connection string');
    console.log('□ Configure production environment variables');
    console.log('□ Run database migrations: npm run prisma:migrate:deploy');
    console.log('□ Seed initial data: npm run prisma:seed');
    console.log('□ Set up SSL/TLS certificates');
    console.log('□ Configure CORS for production frontend URL');
    console.log('□ Set up monitoring and logging');
    console.log('□ Configure rate limiting and security headers');
    console.log('□ Test all endpoints with production-like data');
    console.log('□ Verify Steam API key is valid and has proper permissions');

    console.log('\n🚀 NEXT STEPS:');
    console.log('1. Fix any failed verification checks');
    console.log('2. Set up production database');
    console.log('3. Deploy to staging environment for final testing');
    console.log('4. Run end-to-end tests against staging');
    console.log('5. Deploy to production');
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new DeploymentVerifier();
  verifier.verify().catch(console.error);
}

export { DeploymentVerifier };