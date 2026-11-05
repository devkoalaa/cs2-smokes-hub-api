import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Limite por IP só para quem vem de fora. Chamadas internas (rede Docker, o próprio
// servidor: páginas montadas no servidor, miniaturas, Clodoaldo) chegam todas com o
// mesmo IP e não podem disputar o limite com os usuários. THROTTLE_SKIP_IPS lista
// IPs públicos do próprio servidor, que aparecem quando ele chama o domínio público.
const PRIVATE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|::ffff:(127|10|192\.168)\.|::ffff:172\.(1[6-9]|2\d|3[01])\.)/;

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const ip: string = context.switchToHttp().getRequest().ip || '';
    const skip = (process.env.THROTTLE_SKIP_IPS || '').split(',').map(s => s.trim()).filter(Boolean);
    return PRIVATE.test(ip) || skip.includes(ip.replace(/^::ffff:/, ''));
  }
}
