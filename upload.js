const express = require('express');
const fs = require('fs');

const fileUpload = require('express-fileupload');

module.exports = function(app) {
  app.use(fileUpload({
    useTempFiles: true,
    tempFileDir : `${__dirname}/public/files/`
  }));

  app.post('/upload', (req, res) => {
    let uploadFile = req.files.uploadfile;
    const fileName = uploadFile.name;
    res.json({
      file: `${fileName}`
    })
    uploadFile.mv(
      `${__dirname}/public/files/${fileName}`,
      function (err) {
        if (err) {
          return res.status(500).send(err);
        }
      }
    )
  });
  
  app.get('/upload', (req, res) =>{
    url = req.query.fetch;
    console.log(url);
    res.json({
      file: 'index.html'
    });
  })
  
  app.delete('/upload', express.json({type: '*/*'}), (req, res) => {
      fs.unlinkSync(`${__dirname}/public/files/${req.body.file}`);
      res.json({
          file: 'done'
      });
  });
}
