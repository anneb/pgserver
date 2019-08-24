module.exports = {
    splitSchemaTable : function (tablename) {
        let parts = tablename.split('.');
        if (parts.length === 1) {
            parts.unshift ("public");
        }
        return {
            schema: parts[0],
            name: parts[1],
            fullname: parts.join('.')
        }
    }
}