import { applyDecorators } from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface'
const str:SchemaObject={type:'string'}, uuid:SchemaObject={type:'string',format:'uuid'}, bool:SchemaObject={type:'boolean'}
const obj=(properties:Record<string,SchemaObject>):SchemaObject=>({type:'object',required:Object.keys(properties),properties})
const access=obj({participantActive:bool,canNavigate:{type:'boolean',enum:[false]},canRent:{type:'boolean',enum:[false]},canCheckIn:{type:'boolean',enum:[false]},reason:{type:'string',enum:['INTEGRATION_NOT_VERIFIED']}})
const ticket=obj({id:uuid,participantName:str,participantStatus:str,checkinStatus:str,bookingStatus:str,permissions:access,
  trip:obj({id:uuid,title:str,status:str,startAt:{type:'string',format:'date-time'},endAt:{type:'string',format:'date-time'},destination:obj({id:uuid,name:str})})})
const schemas={ticket,list:obj({items:{type:'array',items:ticket},page:{type:'integer',minimum:1},pageSize:{type:'integer',minimum:1,maximum:50},total:{type:'integer',minimum:0},totalPages:{type:'integer',minimum:0}}),
  claim:obj({ticketId:uuid,tripId:uuid,alreadyClaimed:bool,participantStatus:str,bookingVersion:{type:'integer',minimum:1},currentAccess:access})}
const error=obj({error:{type:'object',required:['code','message','retryable'],properties:{code:str,message:str,retryable:bool,details:{oneOf:[{type:'object',additionalProperties:true},{type:'array',items:{type:'object',additionalProperties:true}}]}}},meta:obj({requestId:str,serverTime:{type:'string',format:'date-time'},contractVersion:str})})
export const ApiTicket=(kind:keyof typeof schemas)=>applyDecorators(
  ApiResponse({status:200,schema:schemas[kind],description:'Personal projection. Operational capability gates M7/M9 are not verified.',headers:{'Cache-Control':{schema:{type:'string',enum:['no-store']}}}}),
  ...[400,401,403,404,...(kind==='claim'?[409]:[]),500].map(status=>ApiResponse({status,schema:error,description:'Shared error envelope; inspect error.code. Self-claim is idempotent by participant/account; no Idempotency-Key required.'})),
)
