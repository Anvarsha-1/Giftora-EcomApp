const User = require('../../models/userSchema')
const Wishlist = require('../../models/wishListSchema')
const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema')

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;

        if (!userId) {
            console.log('No user session found, rendering empty wishlist');
            return res.render('wishlist', { user: null, wishlistItem: [] });
        }
        

        const user = await User.findById(userId);
        console.log(user)
        if (!user) {
            console.log(`User not found for ID: ${userId}`);
            return res.render('wishlist', { user: null, wishlistItem: [] });
        }

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: 'products.productId',
            model: 'Product',

        });

        if (!wishlist || !wishlist.products || wishlist.products.length === 0) {

            return res.render('wishlist', { user, wishlistItem: [] });
        }


        const wishlistItem = wishlist.products.map(item => {
            var productId = item.productId
            const product = item.productId;
            if (!product) {
                console.log(`Product not found for productId: ${item.productId}`);
                return null;
            } else if (product.isBlocked || product.isDeleted || product.quantity < 1 || !product.status === "Available") {
                return null
            }


            return {
                _id: product._id ? product._id.toString() : null,
                name: product.productName || 'Unnamed Product',
                price: product.salesPrice || 0,
                stock: product.quantity || 0,
                image: product.productImage?.[0]?.url || '/images/placeholder.jpg'
            };
        }).filter(item => item !== null);



        return res.render('wishlist', { user, wishlistItem });
    } catch (error) {
        console.error('Error loading wishlist:', error.message, error.stack);
        return res.status(500).render('wishlist', { user: null, wishlistItem: [], error: 'Error loading wishlist' });
    }
};

const addTOWishlist = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.isBlocked || product.isDeleted) {
            return res.status(400).json({ success: false, message: "Product not available" });
        }

        let wishlist = await Wishlist.findOne({ userId });

      
        if (!wishlist) {
            wishlist = new Wishlist({
                userId,
                products: [{ productId }]
            });
            await wishlist.save();
            return res.json({ success: true, inWishlist: true, message: "Added to wishlist" });
        }

    
        const exists = wishlist.products.some(
            (item) => item.productId.toString() === productId
        );

        if (exists) {
            await Wishlist.updateOne(
                { userId },
                { $pull: { products: { productId } } }
            );
            return res.json({ success: true, inWishlist: false, message: "Removed from wishlist" });
        } else {
            await Wishlist.updateOne(
                { userId },
                { $push: { products: { productId } } }
            );
            return res.json({ success: true, inWishlist: true, message: "Added to wishlist" });
        }

    } catch (error) {
        console.error("Error while updating wishlist:", error.message);
        return res.status(500).json({ success: false, message: "Something went wrong. Please try again" });
    }
};


const removeWishlistItem = async (req, res) => {
    try {
        const userId = req.session.user;
        const productId = req.params.id;

        if (!userId || !productId) {
            return res.json({ success: false, message: "Invalid request" });
        }

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.json({ success: false, message: "Wishlist not found" });
        }

        const productExists = wishlist.products.some(p => p.productId.toString() === productId);

        if (!productExists) {
            return res.json({ success: false, message: "Product not in wishlist" });
        }

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        

        return res.json({ success: true, message: "Item removed from wishlist" });

    } catch (error) {
        console.error("Error while deleting wishlist item:", error.message);
        return res.json({ success: false, message: "Something went wrong. Please try again." });
    }
};


module.exports = {
    loadWishlist,
    addTOWishlist,
    removeWishlistItem,
}