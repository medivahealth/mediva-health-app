import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BlogService } from './blog.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { S3Service } from '../common/s3.service';
import { ConfigService } from '@nestjs/config';
import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';
import * as marked from 'marked';

/* ─── DTOs ─── */
class CreateArticleDto {
  @IsString() title!: string;
  @IsString() @IsOptional() excerpt?: string;
  @IsString() @IsOptional() content?: string;
  @IsString() @IsOptional() category?: string;
  @IsString() @IsOptional() imageUrl?: string;
  @IsString() @IsOptional() author?: string;
  @IsArray() @IsOptional() tags?: string[];
  @IsArray() @IsOptional() links?: string[];
  @IsString() @IsOptional() readTime?: string;
  @IsBoolean() @IsOptional() published?: boolean;
}

class FeedbackDto {
  @IsString() message!: string;
}

class UpdateFeedbackDto {
  @IsString() status!: string;
  @IsString() @IsOptional() adminReply?: string;
}

function assertAdmin(req: any) {
  if (req.user?.role !== 'admin') throw new ForbiddenException('Admin access required');
}

@Controller('blog')
export class BlogController {
  constructor(
    private blogService: BlogService,
    private s3Service: S3Service,
    private config: ConfigService,
  ) {}

  /* ═══════ PUBLIC ARTICLE ENDPOINTS ═══════ */

  @Get('articles')
  async listArticles(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.blogService.listArticles(
      category,
      search,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('articles/:id')
  async getArticle(@Param('id') id: string) {
    return this.blogService.getArticle(id);
  }

  @Get('categories')
  async getCategories() {
    return this.blogService.getCategories();
  }

  @Get('articles/:id/view')
  async renderArticlePage(@Param('id') id: string) {
    const article = await this.blogService.getArticle(id);
    const htmlContent = await marked.parse(article.content || article.excerpt || '');
    const dateStr = new Date(article.createdAt).toLocaleDateString();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${article.title} | Mediva AI</title>
          
          <!-- Open Graph / Sharing -->
          <meta property="og:type" content="article">
          <meta property="og:title" content="${article.title}">
          <meta property="og:description" content="${article.excerpt || ''}">
          <meta property="og:image" content="${article.imageUrl || ''}">
          <meta name="twitter:card" content="summary_large_image">
          
          <style>
              :root {
                --primary: #4A90E2;
                --secondary: #1e293b;
                --bg: #f8fafc;
                --card: #ffffff;
                --text: #334155;
              }
              body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
                line-height: 1.6; color: var(--text); max-width: 800px; margin: 0 auto; padding: 20px; background: var(--bg); 
              }
              .article { background: var(--card); padding: 40px; border-radius: 20px; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05); }
              .category { 
                background: rgba(74, 144, 226, 0.1); color: var(--primary); padding: 6px 14px; border-radius: 20px; 
                font-size: 13px; font-weight: 700; text-transform: uppercase; display: inline-block; margin-bottom: 20px; 
                letter-spacing: 0.5px;
              }
              h1 { margin: 0 0 16px 0; font-size: 36px; color: #0f172a; line-height: 1.25; font-weight: 800; }
              .meta { 
                display: flex; align-items: center; gap: 12px;
                color: #64748b; font-size: 14px; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 24px; 
              }
              .stats-badge { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 13px; color: #475569; }
              img.hero { width: 100%; border-radius: 16px; margin-bottom: 30px; object-fit: cover; max-height: 440px; }
              .content { font-size: 19px; color: var(--text); }
              .content h2 { color: #0f172a; margin-top: 40px; font-size: 24px; }
              .content p { margin-bottom: 24px; }
              .content ul, .content ol { margin-bottom: 24px; padding-left: 24px; }
              .content li { margin-bottom: 8px; }
              .content blockquote { 
                border-left: 4px solid var(--primary); background: #f0f7ff; padding: 16px 24px; margin: 24px 0; 
                font-style: italic; border-radius: 0 12px 12px 0;
              }
              
              .footer-cta { 
                margin-top: 60px; padding: 48px; 
                background: linear-gradient(145deg, #1e3a8a 0%, #0f172a 100%); 
                border-radius: 24px; text-align: center; color: #fff; 
                box-shadow: 0 20px 40px -10px rgba(30, 58, 138, 0.3);
              }
              .footer-cta h2 { margin: 0 0 16px 0; color: #fff; font-size: 28px; font-weight: 800; }
              .footer-cta p { opacity: 0.8; margin-bottom: 32px; font-size: 17px; }
              .apps { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; }
              .app-btn { 
                background: #fff; color: #1e3a8a; padding: 16px 32px; border-radius: 14px; 
                text-decoration: none; font-weight: 800; font-size: 16px; border: 2px solid #fff;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
              }
              .app-btn:hover { background: transparent; color: #fff; transform: translateY(-3px); }
              
              @media (max-width: 600px) { 
                body { padding: 12px; } 
                .article { padding: 24px; }
                h1 { font-size: 28px; }
                .footer-cta { padding: 32px 20px; }
              }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
      </head>
      <body>
          <div class="article">
              <div class="category">${article.category}</div>
              <h1>${article.title}</h1>
              <div class="meta">
                <span>By <b>${article.author || 'Mediva Health'}</b></span>
                <span>•</span>
                <span>${dateStr}</span>
                <div style="flex:1"></div>
                <div class="stats-badge">👍 ${article.likes || 0}</div>
                <div class="stats-badge">👁️ ${article.views || 0}</div>
              </div>
              
              ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.title}" class="hero">` : ''}
              
              <div class="content">
                  ${htmlContent}
              </div>
          </div>

          <div class="footer-cta">
              <div class="apps">
                  <a href="https://play.google.com/store/apps" class="app-btn">Download for Android</a>
                  <a href="https://apps.apple.com" class="app-btn">Download for iOS</a>
                  <a href="mediva-ai://discover/${id}" id="open-app" style="display:none;">Open in App</a>
              </div>
          </div>

          <script>
            // Deep link attempt
            if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
              // try simple prompt
            }
          </script>
      </body>
      </html>
    `;
  }

  /* ═══════ AUTHENTICATED USER ENDPOINTS ═══════ */

  @Post('articles/:id/like')
  @UseGuards(JwtAuthGuard)
  async toggleLike(@Request() req: any, @Param('id') id: string) {
    return this.blogService.toggleLike(id, req.user.userId);
  }

  @Post('articles/:id/dislike')
  @UseGuards(JwtAuthGuard)
  async toggleDislike(@Request() req: any, @Param('id') id: string) {
    return this.blogService.toggleDislike(id, req.user.userId);
  }

  @Post('articles/:id/share')
  @UseGuards(JwtAuthGuard)
  async shareArticle(@Param('id') id: string) {
    return this.blogService.shareArticle(id);
  }

  /* ═══════ FEEDBACK ═══════ */

  @Post('feedback')
  @UseGuards(JwtAuthGuard)
  async submitFeedback(@Request() req: any, @Body() dto: FeedbackDto) {
    return this.blogService.submitFeedback(
      req.user.userId,
      dto.message,
      req.user.name || '',
      req.user.email || '',
    );
  }

  /* ═══════ ADMIN ENDPOINTS ═══════ */

  @Get('admin/articles')
  @UseGuards(JwtAuthGuard)
  async adminListArticles(@Request() req: any, @Query('page') page?: string) {
    assertAdmin(req);
    return this.blogService.listAllArticles(page ? parseInt(page) : 1);
  }

  @Post('admin/articles')
  @UseGuards(JwtAuthGuard)
  async adminCreateArticle(@Request() req: any, @Body() dto: CreateArticleDto) {
    assertAdmin(req);
    return this.blogService.createArticle(dto, req.user.userId);
  }

  @Put('admin/articles/:id')
  @UseGuards(JwtAuthGuard)
  async adminUpdateArticle(@Request() req: any, @Param('id') id: string, @Body() dto: CreateArticleDto) {
    assertAdmin(req);
    return this.blogService.updateArticle(id, dto);
  }

  @Delete('admin/articles/:id')
  @UseGuards(JwtAuthGuard)
  async adminDeleteArticle(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    await this.blogService.deleteArticle(id);
    return { success: true };
  }

  @Post('admin/articles/:id/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async adminUploadArticleImage(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertAdmin(req);
    const { url: imageUrl } = await this.s3Service.upload(file.buffer, `articles/${id}-${Date.now()}`, file.mimetype);
    await this.blogService.updateArticle(id, { imageUrl } as any);
    return { imageUrl };
  }

  @Post('admin/upload-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async adminUploadImage(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    assertAdmin(req);
    const { url } = await this.s3Service.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      'cms-assets',
    );
    return { url };
  }

  /* ─── Admin Feedback ─── */

  @Get('admin/feedback')
  @UseGuards(JwtAuthGuard)
  async adminListFeedback(@Request() req: any, @Query('status') status?: string, @Query('page') page?: string) {
    assertAdmin(req);
    return this.blogService.listFeedback(status, page ? parseInt(page) : 1);
  }

  @Put('admin/feedback/:id')
  @UseGuards(JwtAuthGuard)
  async adminUpdateFeedback(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    assertAdmin(req);
    return this.blogService.updateFeedbackStatus(id, dto.status, dto.adminReply);
  }
}
