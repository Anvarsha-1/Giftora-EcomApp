const errorHandler = (err, req, res, next) => {
       
    console.error("error handler", err.stack)
    console.error("Error occurred on:", req.method, req.originalUrl);
    console.error("Error message",err.message)

    const statusCode = err.status || 500
    const message = err.message || "Something went wrong"

    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(statusCode).json(
            {
                success: false,
                message: message
            }
        )
    }

    if (statusCode === 404) {
        return res.status(404).render('user/Page-404', { title: 404, message: message })
    } else if (statusCode === 500) {
        return res.status(500).render('user/error', { title: 404, message: message })
    }
}

module.exports = errorHandler