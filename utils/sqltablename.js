module.exports = function(tableName) {
    return tableName
      .split('.')
      .map(part=>{
        if (part.search(/^[0-9]|[A-Z]|\s/) === -1) {
          return part;
        }
        let newPart = part;
        if (part.search('"') !== -1) {
          newPart = part.replace(/"/g, '\"')
        }
        return `"${newPart}"`
      })
      .join('.')
  }