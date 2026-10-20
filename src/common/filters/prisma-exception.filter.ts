import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Ubah error Prisma yang umum menjadi respons HTTP yang mudah dipahami. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Terjadi kesalahan pada database';

    switch (exception.code) {
      case 'P2002': {
        status = HttpStatus.CONFLICT;
        const target = (exception.meta?.target as string[] | string | undefined) ?? '';
        message = `Data dengan ${Array.isArray(target) ? target.join(', ') : target} yang sama sudah ada`;
        break;
      }
      case 'P2003':
        status = HttpStatus.CONFLICT;
        message = 'Data masih digunakan oleh data lain';
        break;
      case 'P2025':
        status = HttpStatus.NOT_FOUND;
        message = 'Data tidak ditemukan';
        break;
      default:
        console.error(exception);
    }

    response.status(status).json({ statusCode: status, message });
  }
}
