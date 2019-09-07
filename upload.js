const express = require('express');
const fs = require('fs');

const fileUpload = require('express-fileupload');

module.exports = function(app) {
  if (!app) {
    return;
  }
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir : `${__dirname}/admin/files/`
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
}
