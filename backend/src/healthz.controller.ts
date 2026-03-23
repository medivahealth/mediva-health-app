import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthzController {
  @Get('healthz')
  healthz() {
    return {
      ok: true,
      service: 'mediva-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

