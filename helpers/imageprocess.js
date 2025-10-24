function extractImageData(files = []) {
  return files.map((file) => ({
    public_id: file.filename,
    url: file.path,
  }));
}

module.exports = extractImageData;
