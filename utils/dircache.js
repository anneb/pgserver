const fs = require('fs')
const path = require('path');


module.exports = class DirCache {
  constructor(cacheRoot) {
    if (!cacheRoot) {
      this.cacheRoot = path.resolve('./cache/mvt')
    } else {
      this.cacheRoot = cacheRoot;
    }
  }
  getCachedFile(dir, key) {
    const file = path.join(this.cacheRoot, dir, key);
    return new Promise((resolve, reject)=>{
      fs.readFile(file, (err, data) => {
        if (err) {
          resolve(null);
        } else {
          resolve(data)
        }
      })
    })
  }
  setCachedFile(dir, key, data) {
    const dirName = path.join(this.cacheRoot, dir);
    const filePath = path.join(dirName, key);
    console.log(`cache dirname: ${dirName}`);
    console.log(`filePath: ${filePath}`);
    fs.mkdirSync(dirName, {recursive: true});
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      })
    })
  }
}

function cacheDirName(params) {
  return `${path.dirname(__dirname)}/cache/mvt/${params.table}/${params.z}/${params.x}/${params.y}`
}
  
  function cacheFileName(query) {
    if (query.columns) {
      return query.columns;
    }
    return 'noquery';
  }
  
  function getCache(params, query) {
    const dirname = cacheDirName(params);
    const filename = cacheFileName(query);
    
    console.log(`getCache: ${dirname}`);
    return fsPromises.readFile(`${dirname}/${filename}`)
      .then(data=>data)
      .catch(error=>null);
  }
  
  function setCache(params, query, data) {
    const dirname = cacheDirName(params);
    const filename = cacheFileName(query);
    
    console.log(`setCache: ${dirname}`);
    return fsPromises.writeFile(`${dirname}/${filename}`, data)
      .then(() => {return})
      .catch(err=>err);
  }
  
  function lockCache(params, query) {
    const dirname = cacheDirName(params);
    const filename = cacheFileName(query);
    fs.mkdirSync(dirname, {recursive: true});
    return fsPromises.writeFile(`${dirname}/${filename}.lck`, 'lock', {flag: 'wx'})
      .then(()=>{
        return true
      })
      .catch(err=>{
        return fsPromises.stat(`${dirname}/${filename}.lck`)
          .then(st=>{
            console.log(Date.now() - st.ctimeMs);
            if (Date.now() - st.ctimeMs > 240000) {
              return unlockCache(params,query).then(()=>lockCache(params,query));
            } else {
              return false;
            }
          })
          .catch(err=>{
            console.log(err);
            return false;
          });
        });
  }
  
  function unlockCache(params, query){
    const dirname = cacheDirName(params);
    const filename = cacheFileName(query);
    return fsPromises.unlink(`${dirname}/${filename}.lck`)
      .then(()=>true)
      .catch(err=>{
        console.log(`unlockCache: error: ${err}`);
        return false;
      })
  }
  
  function wait(ms) {
    return new Promise((r, j)=>setTimeout(r, ms));
  }
  
  async function waitForCache(params, query) {
    const dirname = cacheDirName(params);
    const filename = cacheFileName(query);
    for (let i = 0; i < 180; i++) {
      console.log(`waiting for cache.. ${i}`);
      await wait(1000);
      data = await getCache(params, query);
      if (data) {
        console.log(`cache wait done.. ${i}`)
        return data;
      }
    }
    console.log(`cache wait failed`);
    return null;
  }
  