const searchVisibility =async (req, res, next) => {

    res.locals.showSearch = false;

    const allowedPaths = ['/', '/home'];

    if (allowedPaths.includes(req.path)) {
        res.locals.showSearch = true;
    }

    next();
};

module.exports={
    searchVisibility
}
