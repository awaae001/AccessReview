// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('grpc');
var proto_registry_pb = require('../proto/registry_pb.js');

function serialize_registry_ConnectionMessage(arg) {
  if (!(arg instanceof proto_registry_pb.ConnectionMessage)) {
    throw new Error('Expected argument of type registry.ConnectionMessage');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_registry_ConnectionMessage(buffer_arg) {
  return proto_registry_pb.ConnectionMessage.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_registry_RegisterRequest(arg) {
  if (!(arg instanceof proto_registry_pb.RegisterRequest)) {
    throw new Error('Expected argument of type registry.RegisterRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_registry_RegisterRequest(buffer_arg) {
  return proto_registry_pb.RegisterRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_registry_RegisterResponse(arg) {
  if (!(arg instanceof proto_registry_pb.RegisterResponse)) {
    throw new Error('Expected argument of type registry.RegisterResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_registry_RegisterResponse(buffer_arg) {
  return proto_registry_pb.RegisterResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


// 服务发现服务，由网关提供
var RegistryServiceService = exports.RegistryServiceService = {
  register: {
    path: '/registry.RegistryService/Register',
    requestStream: false,
    responseStream: false,
    requestType: proto_registry_pb.RegisterRequest,
    responseType: proto_registry_pb.RegisterResponse,
    requestSerialize: serialize_registry_RegisterRequest,
    requestDeserialize: deserialize_registry_RegisterRequest,
    responseSerialize: serialize_registry_RegisterResponse,
    responseDeserialize: deserialize_registry_RegisterResponse,
  },
  // 建立反向连接的双向流
establishConnection: {
    path: '/registry.RegistryService/EstablishConnection',
    requestStream: true,
    responseStream: true,
    requestType: proto_registry_pb.ConnectionMessage,
    responseType: proto_registry_pb.ConnectionMessage,
    requestSerialize: serialize_registry_ConnectionMessage,
    requestDeserialize: deserialize_registry_ConnectionMessage,
    responseSerialize: serialize_registry_ConnectionMessage,
    responseDeserialize: deserialize_registry_ConnectionMessage,
  },
};

exports.RegistryServiceClient = grpc.makeGenericClientConstructor(RegistryServiceService, 'RegistryService');
