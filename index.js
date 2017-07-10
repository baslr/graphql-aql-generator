/*

original by https://github.com/apollographql/graphql-tools

The MIT License (MIT)

Copyright (c) 2015 - 2016 Meteor Development Group, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

'use strict';

const gql = require('graphql-sync');
const lodash_1 = require('lodash');
const db = require('@arangodb').db;

const graphql = gql.graphql;

const buildASTSchema = gql.buildASTSchema;
const extendSchema = gql.extendSchema;
const parse = gql.parse;

const graphql_1 = gql;
const graphql_3 = gql;

function makeExecutableSchema(
  typeDefs,
  resolvers = {},
  connectors,
  logger,
  allowUndefinedInResolve = true,
  resolverValidationOptions = {}) {
  const jsSchema = _generateSchema(typeDefs, resolvers, logger, allowUndefinedInResolve, resolverValidationOptions);
  return jsSchema;
}

function _generateSchema(
  typeDefinitions,
  resolveFunctions,
  logger,
  // TODO: rename to allowUndefinedInResolve to be consistent
  allowUndefinedInResolve,
  resolverValidationOptions
) {
  if (typeof resolverValidationOptions !== 'object') {
    throw new Error('Expected `resolverValidationOptions` to be an object');
  }
  if (!typeDefinitions) {
    throw new Error('Must provide typeDefs');
  }
  if (!resolveFunctions) {
    throw new Error('Must provide resolvers');
  }

  // TODO: check that typeDefinitions is either string or array of strings

  const [ast, schema] = buildSchemaFromTypeDefinitions(typeDefinitions);
  /*print('------- AST ----------');
  print(JSON.stringify(ast, false, 2));
  print('------- AST ----------');*/

    // call generateResolveFunctions



  addResolveFunctionsToSchema(schema, resolveFunctions);

  assertResolveFunctionsPresent(schema, resolverValidationOptions);

  if (!allowUndefinedInResolve) {
    addCatchUndefinedToSchema(schema);
  }

  if (logger) {
    addErrorLoggingToSchema(schema, logger);
  }

/*print('---------- SCHEMA ----------');
  print(JSON.parse(JSON.stringify(schema)));
  print('---------- SCHEMA ----------');*/

  return schema;
}

function buildSchemaFromTypeDefinitions(typeDefinitions) {
  // TODO: accept only array here, otherwise interfaces get confusing.
  let myDefinitions = typeDefinitions;
  let astDocument;

  if (isDocumentNode(typeDefinitions)) {
    astDocument = typeDefinitions;
  } else if (typeof myDefinitions !== 'string') {
    if (!Array.isArray(myDefinitions)) {
      const type = typeof myDefinitions;
      throw new Error(`typeDefs must be a string, array or schema AST, got ${type}`);
    }
    myDefinitions = concatenateTypeDefs(myDefinitions);
  }

  if (typeof myDefinitions === 'string') {
    astDocument = parse(myDefinitions);
  }

  let schema = buildASTSchema(astDocument);

  const extensionsAst = extractExtensionDefinitions(astDocument);
  if (extensionsAst.definitions.length > 0) {
    schema = extendSchema(schema, extensionsAst);
  }

  return [astDocument, schema];
}

function isDocumentNode(typeDefinitions) {
  return typeDefinitions.kind !== undefined;
}

function concatenateTypeDefs(typeDefinitionsAry, calledFunctionRefs) {
    if (calledFunctionRefs === void 0) { calledFunctionRefs = []; }
    var resolvedTypeDefinitions = [];
    typeDefinitionsAry.forEach(function (typeDef) {
        if (isDocumentNode(typeDef)) {
            typeDef = graphql_1.print(typeDef);
        }
        if (typeof typeDef === 'function') {
            if (calledFunctionRefs.indexOf(typeDef) === -1) {
                calledFunctionRefs.push(typeDef);
                resolvedTypeDefinitions = resolvedTypeDefinitions.concat(concatenateTypeDefs(typeDef(), calledFunctionRefs));
            }
        }
        else if (typeof typeDef === 'string') {
            resolvedTypeDefinitions.push(typeDef.trim());
        }
        else {
            var type = typeof typeDef;
            throw new SchemaError("typeDef array must contain only strings and functions, got " + type);
        }
    });
    return lodash_1.uniq(resolvedTypeDefinitions.map(function (x) { return x.trim(); })).join('\n');
}

function extractExtensionDefinitions(ast) {
    var extensionDefs = ast.definitions.filter(function (def) { return def.kind === graphql_1.Kind.TYPE_EXTENSION_DEFINITION; });
    return Object.assign({}, ast, {
        definitions: extensionDefs,
    });
}

function addResolveFunctionsToSchema(schema, resolveFunctions) {
    Object.keys(resolveFunctions).forEach(function (typeName) {
        var type = schema.getType(typeName);
        if (!type && typeName !== '__schema') {
            throw new Error("\"" + typeName + "\" defined in resolvers, but not in schema");
        }
        Object.keys(resolveFunctions[typeName]).forEach(function (fieldName) {
            if (fieldName.startsWith('__')) {
                // this is for isTypeOf and resolveType and all the other stuff.
                // TODO require resolveType for unions and interfaces.
                type[fieldName.substring(2)] = resolveFunctions[typeName][fieldName];
                return;
            }
            if (type instanceof graphql_3.GraphQLScalarType) {
                type[fieldName] = resolveFunctions[typeName][fieldName];
                return;
            }
            var fields = getFieldsForType(type);
            if (!fields) {
                throw new Error(typeName + " was defined in resolvers, but it's not an object");
            }
            if (!fields[fieldName]) {
                throw new Error(typeName + "." + fieldName + " defined in resolvers, but not in schema");
            }
            var field = fields[fieldName];
            var fieldResolve = resolveFunctions[typeName][fieldName];
            if (typeof fieldResolve === 'function') {
                // for convenience. Allows shorter syntax in resolver definition file
                setFieldProperties(field, { resolve: fieldResolve });
            }
            else {
                if (typeof fieldResolve !== 'object') {
                    throw new SchemaError("Resolver " + typeName + "." + fieldName + " must be object or function");
                }
                setFieldProperties(field, fieldResolve);
            }
        });
    });
}

function setFieldProperties(field, propertiesObj) {
    Object.keys(propertiesObj).forEach(function (propertyName) {
        field[propertyName] = propertiesObj[propertyName];
    });
}


function getFieldsForType(type) {
    if ((type instanceof graphql_3.GraphQLObjectType) ||
        (type instanceof graphql_3.GraphQLInterfaceType)) {
        return type.getFields();
    }
    else {
        return undefined;
    }
}

function assertResolveFunctionsPresent(schema, resolverValidationOptions) {
    if (resolverValidationOptions === void 0) { resolverValidationOptions = {}; }
    var _a = resolverValidationOptions.requireResolversForArgs, requireResolversForArgs = _a === void 0 ? false : _a, _b = resolverValidationOptions.requireResolversForNonScalar, requireResolversForNonScalar = _b === void 0 ? false : _b, _c = resolverValidationOptions.requireResolversForAllFields, requireResolversForAllFields = _c === void 0 ? false : _c;
    if (requireResolversForAllFields && (requireResolversForArgs || requireResolversForNonScalar)) {
        throw new TypeError('requireResolversForAllFields takes precedence over the more specific assertions. ' +
            'Please configure either requireResolversForAllFields or requireResolversForArgs / ' +
            'requireResolversForNonScalar, but not a combination of them.');
    }
    forEachField(schema, function (field, typeName, fieldName) {
        // requires a resolve function for *every* field.
        if (requireResolversForAllFields) {
            expectResolveFunction(field, typeName, fieldName);
        }
        // requires a resolve function on every field that has arguments
        if (requireResolversForArgs && field.args.length > 0) {
            expectResolveFunction(field, typeName, fieldName);
        }
        // requires a resolve function on every field that returns a non-scalar type
        if (requireResolversForNonScalar && !(graphql_3.getNamedType(field.type) instanceof graphql_3.GraphQLScalarType)) {
            expectResolveFunction(field, typeName, fieldName);
        }
    });
}

function forEachField(schema, fn) {
    var typeMap = schema.getTypeMap();
    Object.keys(typeMap).forEach(function (typeName) {
        var type = typeMap[typeName];
        // TODO: maybe have an option to include these?
        if (!graphql_3.getNamedType(type).name.startsWith('__') && type instanceof graphql_3.GraphQLObjectType) {
            var fields_1 = type.getFields();
            Object.keys(fields_1).forEach(function (fieldName) {
                var field = fields_1[fieldName];
                fn(field, typeName, fieldName);
            });
        }
    });
}

module.exports = (typeDefs) => makeExecutableSchema(typeDefs);
