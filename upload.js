const express = require('express');
const fs = require('fs');
const ogr2ogr = require('ogr2ogr');
const path = require('path');
const { exec } = require('child_process');

const fileUpload = require('express-fileupload');

module.exports = function(app, pool) {
  if (!app) {
    return;
  }
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir : `${__dirname}/temp/`
  }));

  app.post('/admin/upload', (req, res) => {
    let uploadFile = req.files.uploadfile;
    const fileName = uploadFile.name;
    if (!fileName || fileName === "" ) {
      return res.json({file: "none"});
    }
    uploadFile.mv(
      `${__dirname}/admin/files/${fileName}`,
      function (err) {
        if (err) {
          return res.status(500).send(err.message);
        }
        res.json({
          file: `${fileName}`
        })    
      }
    )
  });
  
  app.get('/admin/upload', (req, res) =>{
    url = req.query.fetch;
    console.log(url);
    res.json({
      file: 'index.html'
    });
  })
  
  app.delete('/admin/upload', express.json({type: '*/*'}), (req, res) => {
      fs.unlinkSync(`${__dirname}/admin/files/${req.body.file}`);
      res.json({
          file: 'done'
      });
  });

  app.get('/admin/list', (req, res)=>{
    let files = fs.readdirSync(`${__dirname}/admin/files`).filter(file=>!file.startsWith('tmp-'));
    files = files.map(file=>{
      let stat = fs.statSync(`${__dirname}/admin/files/${file}`);
      let result = {
        name: file,
        size: stat.size,
        file: !!(stat.mode & 0100000),
        dir: !!(stat.mode &  0040000),
        ctime: stat.ctime,
        mtime: stat.mtime,
        atime: stat.atime,
        permissions: `${(stat.mode & 0040000)?'d':(stat.mode & 0100000)?'f':'-'}${stat.mode & 400?'r':'-'}${stat.mode & 200?'w':'-'}${stat.mode & 100?'x':'-'}${stat.mode & 40?'r':'-'}${stat.mode & 20?'w':'-'}${stat.mode&10?'x':'-'}${stat.mode&4?'r':'-'}${stat.mode&2?'w':'-'}${stat.mode&1?'x':'-'}`,
        nlink: stat.nlink,
        uid: stat.uid,
        gid: stat.gid
      }
      return result;
    })
    res.json(files);
  })

  app.get('/admin/import', (req, res)=>{
    let tablename = path.parse(req.query.file).name.toLowerCase();
    tablename = tablename.replace(/\./g, '_').replace(/ /g, '_');
    exec (`unzip -d "${__dirname}/admin/files/kkk" "${__dirname}/admin/files/${req.query.file}"`, (err, stdout, stderr)=>{
      if (err) {
        console.log('failed to execute unzip');
        return;
      }
      console.log(`${stdout}`);
      console.log(`${stderr}`);
    })
    ogr2ogr(`${__dirname}/admin/files/${req.query.file}`)
    .format('PostgreSQL')
        .destination(`PG:host=${pool.$cn.host} user=${pool.$cn.user} dbname=${pool.$cn.database} password=${pool.$cn.password} port=${pool.$cn.port?pool.$cn.port:5432}`)
        .options(['-nlt', 'PROMOTE_TO_MULTI', '-overwrite', '-lco', 'GEOMETRY_NAME=geom', '-nln', tablename])
        .exec((err, data) => {
            if (err) {
              res.json({error: err.message});
              return;
            }
            res.json({result: "ok"});
        })
  })
}
