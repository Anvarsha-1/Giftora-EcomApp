const errorHandler = (err, req, res, next) => {
  console.error('Error handler:', err.stack);
  console.error('Error occurred on:', req.method, req.originalUrl);

  const statusCode = err.status || 500;
  const message = err.message || 'Something went wrong';

  const isAjax =
    req.xhr || (req.headers.accept && req.headers.accept.includes('json'));

  if (isAjax) {
    return res.status(statusCode).json({
      success: false,
      message,
    });
  }

  // Determine if it's an admin route
  const isAdminRoute = req.originalUrl.startsWith('/admin');

  if (statusCode === 404) {
    return res
      .status(404)
      .render(isAdminRoute ? 'admin/admin-Page-404' : 'user/Page-404', {
        title: 404,
        message,
      });
  } else if (statusCode === 500) {
    return res
      .status(500)
      .render(isAdminRoute ? 'admin/internalServer-error' : 'user/error', {
        title: 500,
        message,
      });
  }
};

module.exports = errorHandler;
