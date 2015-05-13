# angular-json-schema-generator
Angular Service for generating a JSON Schema from given JSON

Project is based on the node Libraries of https://github.com/krg7880/json-schema-generator

##Installation
    - Download zip
    - Include AngularJSONSchemaGenerator.js in the index file
    - Add the Module in your Angular Application:
        angular.module('app', ['ngSchemaGenerator'])
  
    - Use in your Controller:
        angular.module('app').controller('schemaGeneratorCtrl', function(SchemaGenerator){
            $scope.schema = SchemaGenerator.generate({key:"value"});
          })
