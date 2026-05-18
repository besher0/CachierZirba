import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): { service: string; status: string } {
    return {
      service: 'zirba-backend',
      status: 'ok',
    };
  }
}
