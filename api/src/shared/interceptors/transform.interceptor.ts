 
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

export interface Response<T> {
  data: T
  statusCode: number
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    //sử lý trước khi controller chạy
    return next.handle().pipe(
        //sử lý sau khi controller chạy
      map((data) => {
        const response = context.switchToHttp().getResponse()
        const statusCode = response.statusCode
        return { data, statusCode }
      }),
    )
  }
}
