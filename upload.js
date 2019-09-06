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
    res.json({
      file: `${fileName}`
    })
    uploadFile.mv(
      `${__dirname}/admin/files/${fileName}`,
      function (err) {
        if (err) {
          return res.status(500).send(err);
        }
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
}
