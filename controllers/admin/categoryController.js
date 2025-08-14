const Category = require("../../models/categorySchema");
const mongoose = require("mongoose");

const categoryManagement = async (req, res) => {
  try {
    const isClear = req.query.clear === "1";
    const search = isClear ? "" : req.query.search?.trim() || "";

    function escapeRegex(string) {
      return string.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    }
    const escapedSearch = escapeRegex(search);

    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;
    const searchFilter = escapedSearch
      ? {
        $or: [
          { name: { $regex: escapedSearch, $options: "i" } },
          { description: { $regex: escapedSearch, $options: "i" } },
        ],
      }
      : {};

    const categoryData = await Category.find({
      ...searchFilter,
      isDeleted: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCategory = await Category.countDocuments({ isDeleted: { $ne: true } }, searchFilter);
    const totalPages = Math.ceil(totalCategory / limit);
    return res.render("category-page", {
      cat: categoryData,
      currentPage: page,
      totalPages: totalPages,
      totalCategory: totalCategory,
      search,
    });
  } catch (error) {
    console.error("Error in categoryManagement:", error);
    return res.status(500).render("internalServer", {
      message: "An error occurred while fetching categories.",
    });
  }
}

const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: "i" }
    });

    if (existingCategory) {
      return res.status(400).json({ error: "Category already exists" });
    }
    const newCategory = new Category({
      name: name.trim(),
      description: description.trim(),
    });
    await newCategory.save();
    return res.status(201).json({ message: "Category added successfully" });
  } catch (error) {
    console.error("Error while adding category:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const categoryToggle = async (req, res) => {
  const { id } = req.body;

  try {
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Category ID is required" });
    }
    const category = await Category.findById(id);

    if (!category) return res.status(404).json({ success: false, message: "category not found" });

    category.isListed = !category.isListed

    await category.save();

    return res
      .status(200)
      .json({ success: true, message: `Category ${category.isListed ? 'listed' : 'unlisted'} updated successfully` });
  } catch (error) {
    console.error("Toggle error:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const { name, description } = req.body;

    const existing = await Category.findOne({
      name: { $regex: `^${name.trim()}$`, $options: "i" },
      _id: { $ne: id },
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, error: "Category already exists" });
    }

    const updated = await Category.findByIdAndUpdate(
      id,
      {
        name,
        description,
      },
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "category not found" });

    res.status(200).json({ message: "Category edited successfully" });
  } catch (error) {
    console.error("Edit category error:", error);
    res.status(500).json({ message: "Server error while updating category" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const id = req.params.id;


    const existing = await Category.findById(id);

    if (!existing) return res.status(404).json({ error: "User not found" });

    const update = await Category.findByIdAndUpdate(
      id,

      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    if (!update) {
      res.status(400).json({ error: "Unable to delete Category" });
    }

    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.log("Error occured while delete user", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  categoryManagement,
  addCategory,
  categoryToggle,
  editCategory,
  deleteCategory,
};
