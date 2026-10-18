jest.mock('@nestjs/schedule', () => ({
  Interval: () => () => undefined,
}))

import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { PaymentOptionsController, PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { PaymentsPort } from './payments.port'
import { RentalPaymentsController } from '../rental/payments/rental-payments.controller'
import { RentalExtensionPaymentsController } from '../rental/payments/rental-extension-payments.controller'
import { RentalOrderController } from '../rental/ordering/presentation/controllers/rental-order.controller'
import { CreateRentalOrderUseCase } from '../rental/ordering/application/use-cases/create-rental-order.use-case'
import { ListRentalOrdersUseCase } from '../rental/ordering/application/use-cases/list-rental-orders.use-case'
import { GetRentalOrderUseCase } from '../rental/ordering/application/use-cases/get-rental-order.use-case'
import { CancelRentalOrderUseCase } from '../rental/ordering/application/use-cases/cancel-rental-order.use-case'
import { GetRentalPaymentUseCase } from '../rental/ordering/application/use-cases/get-rental-payment.use-case'
import { PreviewRentalCancellationUseCase } from '../rental/ordering/application/use-cases/preview-rental-cancellation.use-case'

describe('Rental payment Swagger contract', () => {
  let app: INestApplication

  beforeAll(async () => {
    const execute = { execute: jest.fn() }
    const moduleRef = await Test.createTestingModule({
      controllers: [
        PaymentsController,
        PaymentOptionsController,
        RentalPaymentsController,
        RentalExtensionPaymentsController,
        RentalOrderController,
      ],
      providers: [
        { provide: PaymentsService, useValue: { paymentOptions: jest.fn() } },
        { provide: PaymentsPort, useValue: {} },
        { provide: CreateRentalOrderUseCase, useValue: execute },
        { provide: ListRentalOrdersUseCase, useValue: execute },
        { provide: GetRentalOrderUseCase, useValue: execute },
        { provide: CancelRentalOrderUseCase, useValue: execute },
        { provide: GetRentalPaymentUseCase, useValue: execute },
        { provide: PreviewRentalCancellationUseCase, useValue: execute },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api/v1')
  })

  afterAll(async () => {
    await app.close()
  })

  it('publishes runnable rental checkout and authoritative status examples', () => {
    const config = new DocumentBuilder().build()
    const document = SwaggerModule.createDocument(app, config)

    const checkout = document.paths['/api/v1/rental-orders/{id}/payments']?.post
    expect(checkout?.operationId).toBe('createRentalOrderPayment')
    expect(checkout?.parameters).toEqual(
      expect.arrayContaining([expect.objectContaining({ in: 'header', name: 'Idempotency-Key', required: true })]),
    )
    expect(checkout?.requestBody).toMatchObject({
      content: {
        'application/json': {
          schema: {
            additionalProperties: false,
            required: ['paymentMethod'],
          },
        },
      },
    })
    expect(checkout?.responses).toEqual(
      expect.objectContaining({
        '200': expect.any(Object),
        '201': expect.any(Object),
        '202': expect.any(Object),
        '409': expect.any(Object),
      }),
    )

    const conflict = checkout?.responses?.['409'] as { content?: Record<string, { examples?: object }> }
    expect(conflict.content?.['application/json'].examples).toEqual(
      expect.objectContaining({ invalidState: expect.any(Object), idempotencyConflict: expect.any(Object) }),
    )

    const orderStatus = document.paths['/api/v1/rental-orders/{id}/payment']?.get
    const orderStatusResponse = orderStatus?.responses?.['200'] as {
      content?: Record<string, { schema?: { example?: Record<string, unknown> } }>
    }
    expect(orderStatus?.operationId).toBe('getRentalOrderPaymentStatus')
    expect(orderStatusResponse.content?.['application/json'].schema?.example).toMatchObject({
      status: 'SUCCEEDED',
      applicationStatus: 'APPLIED',
      invoiceStatus: 'PAID',
      orderStatus: 'PAID',
    })

    const extensionStatus = document.paths['/api/v1/rental-extensions/{id}/payment']?.get
    const extensionResponse = extensionStatus?.responses?.['200'] as {
      content?: Record<string, { schema?: { example?: Record<string, unknown> } }>
    }
    expect(extensionStatus?.operationId).toBe('getRentalExtensionPaymentStatus')
    expect(extensionResponse.content?.['application/json'].schema?.example).toMatchObject({
      paymentStatus: 'SUCCEEDED',
      applicationStatus: 'APPLIED',
      extensionStatus: 'APPLIED',
    })

    const optionsResponse = document.paths['/api/v1/payments/options']?.get?.responses?.['200'] as {
      content?: Record<string, { schema?: { example?: Record<string, unknown> } }>
    }
    expect(optionsResponse.content?.['application/json'].schema?.example).toMatchObject({
      defaultGateway: 'vnpay',
      gateways: expect.any(Array),
    })

    const notFound = extensionStatus?.responses?.['404'] as {
      content?: Record<string, { schema?: { example?: Record<string, unknown> } }>
    }
    expect(notFound.content?.['application/json'].schema?.example).toMatchObject({
      error: { code: 'PAYMENT_NOT_FOUND', retryable: false },
      meta: { contractVersion: '0.2.0-final-flow' },
    })
  })
})
