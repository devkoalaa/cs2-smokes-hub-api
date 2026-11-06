import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Header, Injectable, NotFoundException, Param, ParseIntPipe,
  Post, Put, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { User } from '@prisma/client';
import { randomInt } from 'crypto';
import sharp from 'sharp';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, randomCode } from './tracking.access';
import { BotTokenGuard } from './tracking.bot';
import { DiscordLinkDto } from './tracking.dto';

type Viewer = Pick<User, 'id' | 'steamId' | 'accessGrantedAt'>;
/** Arquivo que o multer deixa em memória (só o que usamos). */
type Upload = { buffer: Buffer };

/** Endereço público da imagem, já com o prefixo /api do Caddy. */
export const imageUrl = (key?: string | null) => key ? `/api/tracking/images/${key}` : null;

const MAX_UPLOAD = 6 * 1024 * 1024;
const upload = FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD, files: 1 } });
// Banner largo (cabe no topo do perfil em qualquer tela) e foto quadrada de grupo.
const SIZES = { banner: { width: 1600, height: 640 }, avatar: { width: 256, height: 256 } } as const;

// Código digitado no Discord: só maiúsculas e números sem os que se confundem (0/O, 1/I).
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_TTL = 15 * 60_000;

@Injectable()
export class MediaService {
  constructor(private readonly db: PrismaService, private readonly access: AccessService) {}

  /**
   * Decodifica e regrava como WebP: tira metadados (EXIF com GPS etc.) e garante que só
   * sai imagem de verdade, seja qual for o arquivo enviado.
   */
  private async convert(file: Upload | undefined, size: { width: number; height: number }) {
    if (!file?.buffer?.length) throw new BadRequestException('Envie uma imagem.');
    try {
      return await sharp(file.buffer, { limitInputPixels: 50_000_000, animated: false }).rotate()
        .resize(size.width, size.height, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer();
    } catch {
      throw new BadRequestException('Não deu para ler essa imagem. Use JPG, PNG ou WebP.');
    }
  }

  async setBanner(user: Viewer, file?: Upload) {
    await this.access.assertAccess(user);
    const data = await this.convert(file, SIZES.banner);
    const key = randomCode(24);
    await this.db.$transaction([
      this.db.image.deleteMany({ where: { userId: user.id } }),
      this.db.image.create({ data: { key, data: new Uint8Array(data), userId: user.id } }),
    ]);
    return { url: imageUrl(key) };
  }

  async removeBanner(user: Viewer) {
    await this.db.image.deleteMany({ where: { userId: user.id } });
    return { url: null };
  }

  private async owned(user: Viewer, groupId: number) {
    await this.access.assertAccess(user);
    const { group } = await this.access.membership(user.id, groupId);
    if (group.ownerId !== user.id) throw new ForbiddenException('Só quem criou o grupo pode trocar a foto.');
  }

  async setGroupAvatar(user: Viewer, groupId: number, file?: Upload) {
    await this.owned(user, groupId);
    const data = await this.convert(file, SIZES.avatar);
    const key = randomCode(24);
    await this.db.$transaction([
      this.db.image.deleteMany({ where: { groupId } }),
      this.db.image.create({ data: { key, data: new Uint8Array(data), groupId } }),
    ]);
    return { url: imageUrl(key) };
  }

  async removeGroupAvatar(user: Viewer, groupId: number) {
    await this.owned(user, groupId);
    await this.db.image.deleteMany({ where: { groupId } });
    return { url: null };
  }

  async image(key: string) {
    if (!/^[A-Za-z0-9]{24}$/.test(key)) throw new NotFoundException();
    const image = await this.db.image.findUnique({ where: { key }, select: { data: true } });
    if (!image) throw new NotFoundException();
    return Buffer.from(image.data);
  }

  // ---------- Discord ----------

  /** Gera o código que a pessoa manda no /cs2 vincular do Clodoaldo. */
  async discordCode(user: Viewer) {
    await this.access.assertAccess(user);
    const code = Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    const expiresAt = new Date(Date.now() + CODE_TTL);
    await this.db.user.update({ where: { id: user.id }, data: { discordCode: code, discordCodeExpiresAt: expiresAt } });
    return { code, expiresAt };
  }

  async unlinkDiscord(user: Viewer) {
    await this.db.user.update({ where: { id: user.id }, data: { discordId: null, discordName: null, discordCode: null, discordCodeExpiresAt: null } });
    return { name: null };
  }

  /** Chamado pelo bot: o Discord garante quem digitou, o código garante de qual conta Steam. */
  async linkDiscord(dto: DiscordLinkDto) {
    return this.db.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { discordCode: dto.code }, select: { id: true, username: true, discordCodeExpiresAt: true } });
      if (!user || !user.discordCodeExpiresAt || user.discordCodeExpiresAt < new Date()) throw new NotFoundException('Código inválido ou vencido.');
      // Um Discord fica preso a uma conta só: se já estava em outra, sai de lá.
      await tx.user.updateMany({ where: { discordId: dto.discordId, id: { not: user.id } }, data: { discordId: null, discordName: null } });
      await tx.user.update({ where: { id: user.id }, data: { discordId: dto.discordId, discordName: dto.discordName, discordCode: null, discordCodeExpiresAt: null } });
      return { username: user.username };
    });
  }

  async unlinkByDiscord(discordId: string) {
    if (!/^\d{17,20}$/.test(discordId)) throw new NotFoundException();
    const { count } = await this.db.user.updateMany({ where: { discordId }, data: { discordId: null, discordName: null } });
    if (!count) throw new NotFoundException('Esse Discord não está vinculado a nenhuma conta.');
    return { unlinked: true };
  }
}

@ApiTags('partidas')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('tracking')
export class MediaController {
  constructor(private readonly service: MediaService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Put('me/banner') @UseInterceptors(upload)
  setBanner(@Req() req: any, @UploadedFile() file?: Upload) { return this.service.setBanner(req.user, file); }
  @Delete('me/banner') removeBanner(@Req() req: any) { return this.service.removeBanner(req.user); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Put('groups/:id/avatar') @UseInterceptors(upload)
  setAvatar(@Req() req: any, @Param('id', ParseIntPipe) id: number, @UploadedFile() file?: Upload) { return this.service.setGroupAvatar(req.user, id, file); }
  @Delete('groups/:id/avatar') removeAvatar(@Req() req: any, @Param('id', ParseIntPipe) id: number) { return this.service.removeGroupAvatar(req.user, id); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('me/discord') discordCode(@Req() req: any) { return this.service.discordCode(req.user); }
  @Delete('me/discord') unlinkDiscord(@Req() req: any) { return this.service.unlinkDiscord(req.user); }
}

// Público de propósito: <img> não manda o token. A chave aleatória faz o papel de senha.
@ApiExcludeController()
@SkipThrottle()
@Controller('tracking/images')
export class ImagesController {
  constructor(private readonly service: MediaService) {}
  @Get(':key')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  @Header('X-Content-Type-Options', 'nosniff')
  async image(@Param('key') key: string) { return new StreamableFile(await this.service.image(key), { type: 'image/webp' }); }
}

@ApiExcludeController()
@UseGuards(BotTokenGuard)
@Controller('tracking/bot/discord')
export class BotDiscordController {
  constructor(private readonly service: MediaService) {}
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('link') link(@Body() dto: DiscordLinkDto) { return this.service.linkDiscord(dto); }
  @Delete(':discordId') unlink(@Param('discordId') discordId: string) { return this.service.unlinkByDiscord(discordId); }
}
