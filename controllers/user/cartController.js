const Cart = require('../../models/cartSchema')
const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Wishlist = require('../../models/wishListSchema')
const mongoose = require('mongoose');

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = userId ? await User.findById(userId) : undefined;

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('cart', {
                user,
                cartItems: [],
                total: 0,
                subTotal: 0,
                tax: 0,
                totalQuantity: 0,
                deliveryMessage: "Free delivery on order above ₹1000",
                shipping: 50
            });
        }

        let subTotal = 0;
        let totalQuantity = 0;

        const validItems = cart.items.filter(item => {
            const product = item.productId;
            return product && !product.isBlocked && !product.isDeleted ;
        });

        if (validItems.length === 0) {
            return res.render('cart', {
                user,
                cartItems: [],
                total: 0,
                subTotal: 0,
                tax: 0,
                totalQuantity: 0,
                deliveryMessage: "Free delivery on order above ₹1000",
                shipping: 50
            });
        }

        const cartItems = validItems.map(item => {
            const product = item.productId;
            const price = Number(product.salesPrice) || 0;
            const safeQuantity = Math.min(item.quantity, product.quantity || 1)
            const itemTotal = price * safeQuantity;


            subTotal += itemTotal;
            totalQuantity += safeQuantity;

            return {
                _id: product._id,
                name: product.productName || 'Unnamed Product',
                price: product.salesPrice,
                quantity: safeQuantity,
                stock: product.quantity || 0,
                image: product.productImage?.[0]?.url || '/images/placeholder.jpg',
                totalPrice: itemTotal,
            };
        });

        const tax = Math.round(subTotal * 0.05);
        const shipping = subTotal >= 1000 ? 0 : 50;
        const total = subTotal + tax + shipping;
        const deliveryMessage = subTotal >= 1000
            ? "Free delivery on order above ₹1000"
            : "₹50 shipping charge for orders below ₹1000";


        req.session.allowCheckout = true

        return res.render('cart', {
            user,
            cartItems,
            subTotal,
            tax,
            shipping,
            total,
            totalQuantity,
            deliveryMessage,
        });

    } catch (error) {
        console.error('Error loading cart:', error.message);
        return res.status(500).render('error', {
            title: "Error",
            message: "Error happened while loading cart Page. Please try again",
        });
    }
};



const addToCart = async (req, res) => {

    try {

        const userId = req.session.user

        const { productId, quantity } = req.body

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" })
        }
        const product = await Product.findById({ _id: productId, isBlocked: false, isDeleted: false })


        if (!product) {
            return res.json({ success: false, message: "Product not found" })
        }

        if (product.isDeleted || product.isBlocked) {
            return res.json({ success: false, message: "Product not available" })
        }

        if (product.quantity <= 0 || !product.status === "Available") {
            return res.json({ success: false, message: "Product is out of stock" })
        }

        const qty = parseInt(quantity)

        if (isNaN(qty) || qty <= 0) {
            return res.json({ success: false, message: "Invalid Quantity" })
        }


        const price = product.salesPrice || product.regularPrice

        const total = price * qty



        let cart = await Cart.findOne({ userId })

        if (!cart) {
            cart = new Cart({
                userId,
                items: [
                    {
                        productId: productId,
                        quantity: qty,
                        price,
                        totalPrice: total,

                    }
                ]
            });
        } else {


            const itemIndex = cart.items.findIndex(
                item => item.productId.toString() === productId
            );

            if (itemIndex > -1) {
                const newQty = cart.items[itemIndex].quantity + qty;

                if (newQty > product.quantity) {
                    return res.json({ success: false, message: "Quantity exceeds stock." });
                }
                if (newQty > 10) {
                    return res.json({ success: false, message: "Cart item limit reached." });
                }


                cart.items[itemIndex].quantity = newQty;
                cart.items[itemIndex].totalPrice = newQty * cart.items[itemIndex].price;
            } else {

                if (cart.items.length >= 10) {
                    return res.json({ success: false, message: "Cart item limit (10) reached." });
                }

                cart.items.push({
                    productId,
                    quantity: qty,
                    price,
                    totalPrice: total
                });
            }
        }

        const wishlist = await Wishlist.findOne({ userId })

        if (wishlist) {
            const matched = wishlist.products.some(p => p.productId.toString() === productId);
            if (matched) {
                await Wishlist.updateOne(
                    { userId },
                    { $pull: { products: { productId: productId } } }

                );
            }
        }



        await cart.save();
        return res.json({ success: true, message: "Product added to cart" });

    } catch (error) {
        console.error("error while adding item in cart ", error);
        return res.json({ success: false, message: "Something went wrong" });
    }
}


const updateCartQuantity = async (req, res) => {
    try {

        const userId = req.session.user
        const { itemId, quantity } = req.body
        const user = await User.findById(req.session.user)
       

        if (!user) {
            return res.json({ success: false, message: "User not logged in" })
        }

        const newQuantity = quantity

        if (isNaN(newQuantity) || newQuantity < 1) {
            return res.json({ success: false, message: "Invalid quantity" })
        }

        const cart = await Cart.findOne({ userId })
       

        const item = cart.items.find(i => i.productId.toString() === itemId)


        if (!item) {
            return res.json({ success: false, message: "Item not found in cart" })
        }

        const product = await Product.findById(item.productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" })
        }

        if (product.isBlocked || product.isDeleted) {
            return res.status(404).json({ success: false, message: "This product is no longer available" })
        }

        if (newQuantity > 10) {
            return res.json({ success: false, message: "cart quantity limit reached" })
        }

        if (newQuantity > product.quantity) {
            return res.json({ success: false, message: `only ${product.quantity} in stock.` })
        }

        item.quantity = newQuantity
        item.totalPrice = product.salesPrice * quantity;
        cart.total = cart.items.reduce((sum, i) => sum + i.totalPrice, 0);
        cart.totalQuantity = cart.items.reduce((sum, i) => sum + i.quantity, 0);
  
        


        const subTotal = cart.total;
        const tax = Math.round(subTotal * 0.05);
        const shipping = subTotal >= 1000 ? 0 : 50;
        const total = subTotal + tax + shipping;

        await cart.save();

        res.json({
            success: true,
            subTotal,
            tax,
            itemTotal: item.totalPrice,
            itemQuantity: item.quantity,
            stock: product.quantity,
            shipping,
            total,
            totalQuantity: cart.totalQuantity
        });

    } catch (error) {
        console.error("Update quantity error:", error);
        res.json({ success: false, message: "Server error" });
    }
}

const removeCartItem = async (req, res) => {
    try {
        const productId = req.params.id
        const userId = req.session.user

        if (!productId) {
            return res.json({ success: false, message: "product is undefined" })
        }

        const cart = await Cart.findOne({ userId })

        if (!cart) {
            return res.json({ success: false, message: "Cart not found" })
        }

        await Cart.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId: productId } } }
        )
        return res.json({ success: true, message: "item removed from cart" })


    } catch (error) {
        console.log("Error while removing item from cart", error.message)
        return res.json({ success: false, message: "Something went wrong. Please try again." })
    }
}
const updateCartCount = async (req, res) => {
    let validItems = [];
    let validWishlist = [];

    try {
        const userId = req.session.user;
       

        if (!userId) {
            return res.json({ success: false, wishlistCount: 0, cartCount: 0 });
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');
        const wishlist = await Wishlist.findOne({ userId }).populate('products.productId');

        if (!cart || !cart.items) {
            return res.json({ success: true, cartCount: 0, wishlistCount: wishlist ? wishlist.products.length : 0 });
        }



        if (cart && Array.isArray(cart.items)) {
            validItems = cart.items.filter(item => {
                const product = item.productId;
                return (
                    product &&
                    !product.isBlocked &&
                    !product.isDeleted
                );
            });
        }

        if (wishlist && Array.isArray(wishlist.products)) {
            validWishlist = wishlist.products.filter(item => {
                const product = item.productId;
                return (
                    product &&
                    !product.isBlocked &&
                    !product.isDeleted
                );
            });
        }

        return res.json({
            success: true,
            cartCount: validItems.length,
            wishlistCount: validWishlist.length
        });

    } catch (error) {
        console.error("Error update cart count", error.message);
        return res.status(500).json({
            success: false,
            message: "Server error",
            cartCount: validItems.length,
            wishlistCount: validWishlist.length
        });
    }
};



module.exports = {
    loadCart,
    addToCart,
    updateCartQuantity,
    removeCartItem,
    updateCartCount,
}

