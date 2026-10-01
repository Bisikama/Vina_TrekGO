import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface ApiResponse<T> {
  data: T
  meta: {
    statusCode: number
    serverTime: string
  }
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    // Xử lý trước khi controller chạy.

    return next.handle().pipe(
      // Xử lý response sau khi controller/use case chạy thành công.
      map((data: T) => {
        const response = context.switchToHttp().getResponse()

        return {
          data,
          meta: {
            statusCode: response.statusCode,
            serverTime: new Date().toISOString(),
          },
        }
      }),
    )
  }
}