// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var cooldown_service_pb = require('./cooldown_service_pb.js');

function serialize_cooldown_AddBlacklistRequest(arg) {
  if (!(arg instanceof cooldown_service_pb.AddBlacklistRequest)) {
    throw new Error('Expected argument of type cooldown.AddBlacklistRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_AddBlacklistRequest(buffer_arg) {
  return cooldown_service_pb.AddBlacklistRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_AddBlacklistResponse(arg) {
  if (!(arg instanceof cooldown_service_pb.AddBlacklistResponse)) {
    throw new Error('Expected argument of type cooldown.AddBlacklistResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_AddBlacklistResponse(buffer_arg) {
  return cooldown_service_pb.AddBlacklistResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_BatchGetCooldownRequest(arg) {
  if (!(arg instanceof cooldown_service_pb.BatchGetCooldownRequest)) {
    throw new Error('Expected argument of type cooldown.BatchGetCooldownRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_BatchGetCooldownRequest(buffer_arg) {
  return cooldown_service_pb.BatchGetCooldownRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_BatchGetCooldownResponse(arg) {
  if (!(arg instanceof cooldown_service_pb.BatchGetCooldownResponse)) {
    throw new Error('Expected argument of type cooldown.BatchGetCooldownResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_BatchGetCooldownResponse(buffer_arg) {
  return cooldown_service_pb.BatchGetCooldownResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_BlacklistResponse(arg) {
  if (!(arg instanceof cooldown_service_pb.BlacklistResponse)) {
    throw new Error('Expected argument of type cooldown.BlacklistResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_BlacklistResponse(buffer_arg) {
  return cooldown_service_pb.BlacklistResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_CooldownResponse(arg) {
  if (!(arg instanceof cooldown_service_pb.CooldownResponse)) {
    throw new Error('Expected argument of type cooldown.CooldownResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_CooldownResponse(buffer_arg) {
  return cooldown_service_pb.CooldownResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_GetAllBlacklistRequest(arg) {
  if (!(arg instanceof cooldown_service_pb.GetAllBlacklistRequest)) {
    throw new Error('Expected argument of type cooldown.GetAllBlacklistRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_GetAllBlacklistRequest(buffer_arg) {
  return cooldown_service_pb.GetAllBlacklistRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_GetAllBlacklistResponse(arg) {
  if (!(arg instanceof cooldown_service_pb.GetAllBlacklistResponse)) {
    throw new Error('Expected argument of type cooldown.GetAllBlacklistResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_GetAllBlacklistResponse(buffer_arg) {
  return cooldown_service_pb.GetAllBlacklistResponse.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_GetBlacklistRequest(arg) {
  if (!(arg instanceof cooldown_service_pb.GetBlacklistRequest)) {
    throw new Error('Expected argument of type cooldown.GetBlacklistRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_GetBlacklistRequest(buffer_arg) {
  return cooldown_service_pb.GetBlacklistRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_cooldown_GetCooldownRequest(arg) {
  if (!(arg instanceof cooldown_service_pb.GetCooldownRequest)) {
    throw new Error('Expected argument of type cooldown.GetCooldownRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_cooldown_GetCooldownRequest(buffer_arg) {
  return cooldown_service_pb.GetCooldownRequest.deserializeBinary(new Uint8Array(buffer_arg));
}


// 冷却服务定义
var CooldownServiceService = exports.CooldownServiceService = {
  // 获取用户自动申请冷却状态
getAutoApplyCooldown: {
    path: '/cooldown.CooldownService/GetAutoApplyCooldown',
    requestStream: false,
    responseStream: false,
    requestType: cooldown_service_pb.GetCooldownRequest,
    responseType: cooldown_service_pb.CooldownResponse,
    requestSerialize: serialize_cooldown_GetCooldownRequest,
    requestDeserialize: deserialize_cooldown_GetCooldownRequest,
    responseSerialize: serialize_cooldown_CooldownResponse,
    responseDeserialize: deserialize_cooldown_CooldownResponse,
  },
  // 获取用户拉黑状态
getBlacklistStatus: {
    path: '/cooldown.CooldownService/GetBlacklistStatus',
    requestStream: false,
    responseStream: false,
    requestType: cooldown_service_pb.GetBlacklistRequest,
    responseType: cooldown_service_pb.BlacklistResponse,
    requestSerialize: serialize_cooldown_GetBlacklistRequest,
    requestDeserialize: deserialize_cooldown_GetBlacklistRequest,
    responseSerialize: serialize_cooldown_BlacklistResponse,
    responseDeserialize: deserialize_cooldown_BlacklistResponse,
  },
  // 添加用户到拉黑列表
addToBlacklist: {
    path: '/cooldown.CooldownService/AddToBlacklist',
    requestStream: false,
    responseStream: false,
    requestType: cooldown_service_pb.AddBlacklistRequest,
    responseType: cooldown_service_pb.AddBlacklistResponse,
    requestSerialize: serialize_cooldown_AddBlacklistRequest,
    requestDeserialize: deserialize_cooldown_AddBlacklistRequest,
    responseSerialize: serialize_cooldown_AddBlacklistResponse,
    responseDeserialize: deserialize_cooldown_AddBlacklistResponse,
  },
  // 获取所有拉黑用户
getAllBlacklistedUsers: {
    path: '/cooldown.CooldownService/GetAllBlacklistedUsers',
    requestStream: false,
    responseStream: false,
    requestType: cooldown_service_pb.GetAllBlacklistRequest,
    responseType: cooldown_service_pb.GetAllBlacklistResponse,
    requestSerialize: serialize_cooldown_GetAllBlacklistRequest,
    requestDeserialize: deserialize_cooldown_GetAllBlacklistRequest,
    responseSerialize: serialize_cooldown_GetAllBlacklistResponse,
    responseDeserialize: deserialize_cooldown_GetAllBlacklistResponse,
  },
  // 批量查询多个用户的冷却状态
batchGetCooldownStatus: {
    path: '/cooldown.CooldownService/BatchGetCooldownStatus',
    requestStream: false,
    responseStream: false,
    requestType: cooldown_service_pb.BatchGetCooldownRequest,
    responseType: cooldown_service_pb.BatchGetCooldownResponse,
    requestSerialize: serialize_cooldown_BatchGetCooldownRequest,
    requestDeserialize: deserialize_cooldown_BatchGetCooldownRequest,
    responseSerialize: serialize_cooldown_BatchGetCooldownResponse,
    responseDeserialize: deserialize_cooldown_BatchGetCooldownResponse,
  },
};

exports.CooldownServiceClient = grpc.makeGenericClientConstructor(CooldownServiceService, 'CooldownService');
