const PageNotFound = async (req, res) => {
  try {
    res.status(404).render("user/Page-404", {
      title: "404 - Page Not Found",
      message: "Oops! The page you're looking for doesn't exist.",
    });
  } catch (error) {
    console.error("Error rendering 404 page:", error.message);
    res.redirect("/");
  }
};



const loadHomePage = async (req, res) => {
  try {
    console.log("ji")
    return res.render("user/landing-page");

  } catch (error) {
    console.log("Home page not found")
    res.status(500).send("Server Error");
  }
};

module.exports={
    loadHomePage,
    PageNotFound
}
