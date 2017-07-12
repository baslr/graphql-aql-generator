'use strict';

module.exports = (ast, resolveFunctions) => {
  ast.definitions.forEach( objectDefinition => {

    if (objectDefinition.kind !== 'ObjectTypeDefinition') return;

    if (objectDefinition.name.value == 'Query') {
      // console.log('objectDefinition Query');

      objectDefinition.fields.forEach(field => {
        const fieldName = field.name.value;
        // print('fieldName', fieldName);
        const collection = field.type.name.value;
        // print('collection', collection);
        
        /*const args = field.arguments;
        const argList = [];

        for (const arg of args) {
            print('arg.name.value', arg.name.value);
            print('arg.type.type.name.value', arg.type.type.name.value);

            argList.push({[arg.name.value]: arg.type.type.name.value});
        } // for*/

        if (!resolveFunctions['Query']) resolveFunctions['Query'] = {};
        resolveFunctions['Query'][fieldName] = function(dontknow, args, dontknow2, astPart) { // a undefined, b id:4, undefined, astpart

            // print(args);

            const filterList = Object.keys(args).map(arg => `doc.${arg} == ${'string' === typeof args[arg] ? "'" + args[arg] + "'" : args[arg] }`);

            // print('filterList', filterList);
            // print(`for doc in ${collection} filter ${filterList.join(' AND ')} return doc`);
            const res = db._query(`for doc in ${collection} filter ${filterList.join(' AND ')} return doc`).toArray();

            return res.pop();
        } // function      
      }); // fields.forEach
    } else { // if field.name.value == Query
      /*print('----- != QUERY -----');
      print(JSON.parse(JSON.stringify(objectDefinition)));
      print('----- != QUERY -----');*/
      const objectTypeName = objectDefinition.name.value;
      // print('objectTypeName', objectTypeName);
      objectDefinition.fields.forEach(field => {
        const fieldName = field.name.value;

        const isArray = 'ListType' === field.type.kind ? true : false;

        if (field.directives.length) {
          const directive = field.directives.shift();

          if ('aql' === directive.name.value) {
            const arg = directive.arguments.shift();
            if ('exec' === arg.name.value) {
              const aql = arg.value.value;
              const parseResult = db._parse(aql);
              /*print('---parse result-----');
              print(parseResult);
              print('---parse result-----');*/


              // ?: will be fixed by https://github.com/arangodb/arangodb/pull/2772 sometimes
              const usesCurrent = !!~(parseResult.bindVars ? parseResult.bindVars : parseResult.parameters).indexOf('current');

              if (!resolveFunctions[objectTypeName]) resolveFunctions[objectTypeName] = {};

              resolveFunctions[objectTypeName][fieldName] = function(obj, emptyObject, dontknow, returnTypeOperationDesc) {

                /*print('-- ARGUMENTS --');
                print(JSON.parse(JSON.stringify(arguments)));
                print('-- ARGUMENTS --');
                print('-----OBJ-----');
                print(obj);
                print('-----OBJ-----');*/

                const params = {};
                if (usesCurrent) {
                  params.current = obj;
                }
                const res = db._query(aql, params).toArray();

                if (isArray) {
                  return res;
                } else {
                  return res.pop();
                }
              }
            }
          } // if
        } // if
      });
    }
  }); // forEach
}
