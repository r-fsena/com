import crypto from 'crypto';
import { db } from '@/db';
import { users, memberships, tenants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { signSessionPayload, AuthenticatedSession } from '@/lib/api-auth';
import { UserRole } from '@/types/crm';

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: AuthenticatedSession;
  sessionToken?: string;
}

export class AuthService {
  /**
   * Gera hash seguro com scrypt (padrão de alta segurança da biblioteca nativa do Node.js)
   */
  static hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
    const salt = existingSalt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  /**
   * Verifica se uma senha informada corresponde ao hash e salt gravados no banco
   */
  static verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  }

  /**
   * Autenticação Híbrida:
   * 1. Se houver cognitoSub ou integração ativa com AWS Cognito, valida o token Cognito
   * 2. Valida contra o PostgreSQL oficial (tabela users e memberships)
   */
  static async authenticateUser(email: string, password?: string, cognitoSub?: string, targetTenantId?: string): Promise<LoginResult> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, error: 'E-mail é obrigatório para autenticação.' };
    }

    try {
      // 1. Busca usuário no PostgreSQL
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);

      const dbUser = userRows[0];

      if (!dbUser) {
        return { success: false, error: 'Usuário não cadastrado na plataforma.' };
      }

      if (!dbUser.isActive) {
        return { success: false, error: 'Esta conta de usuário foi desativada.' };
      }

      // Identificadores Cognito enviados pelo cliente não comprovam autenticação.
      if (cognitoSub || !password || password.length > 1024 || !dbUser.passwordHash || !dbUser.salt ||
          !this.verifyPassword(password, dbUser.passwordHash, dbUser.salt)) {
        return { success: false, error: 'E-mail ou senha inválidos. Contas sem senha devem ser provisionadas pelo administrador.' };
      }

      const memberRows = await db.select({ role: memberships.role, tenantId: tenants.id, tenantSlug: tenants.slug })
        .from(memberships).innerJoin(tenants, eq(memberships.tenantId, tenants.id))
        .where(and(eq(memberships.userId, dbUser.id), eq(memberships.isActive, true), eq(tenants.status, 'ACTIVE')));
      const target = targetTenantId?.replace(/^tenant-/, '');
      const membership = memberRows.find(m => !target || m.tenantId === targetTenantId || m.tenantSlug === target);
      const globalAdmin = memberRows.find(m => m.role === 'SUPERADMIN');
      let resolvedTenantSlug = membership ? `tenant-${membership.tenantSlug}` : '';
      if (!membership && globalAdmin && target) {
        const targetRows = await db.select().from(tenants).where(eq(tenants.slug, target)).limit(1);
        if (targetRows[0]?.status === 'ACTIVE') resolvedTenantSlug = `tenant-${targetRows[0].slug}`;
      }
      if (!resolvedTenantSlug || (!membership && !globalAdmin)) return { success: false, error: 'Usuário sem vínculo ativo com a imobiliária.' };
      const role: UserRole = globalAdmin ? 'SUPERADMIN' : membership!.role;

      // 4. Monta o payload de sessão seguro
      const sessionData: AuthenticatedSession = {
        userId: dbUser.id,
        userEmail: dbUser.email,
        userName: dbUser.fullName,
        role,
        tenantId: resolvedTenantSlug,
        isSuperAdmin: role === 'SUPERADMIN',
      };

      const sessionToken = signSessionPayload(sessionData);

      return {
        success: true,
        user: sessionData,
        sessionToken,
      };
    } catch (err: any) {
      console.error('[AuthService] Erro na autenticação:', err);
      return { success: false, error: err.message || 'Erro ao autenticar usuário.' };
    }
  }
}
