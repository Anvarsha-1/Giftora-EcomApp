document.addEventListener('DOMContentLoaded', () => {
    // --- Back to Top Button ---
    const backToTopButton = document.getElementById('back-to-top');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 300) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        });
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Mini Cart ---
    const miniCartOverlay = document.getElementById('mini-cart-overlay');
    const miniCart = document.getElementById('mini-cart');
    const miniCartCloseBtns = document.querySelectorAll('.mini-cart-close');

    function openMiniCart() {
        if (miniCartOverlay && miniCart) {
            miniCartOverlay.classList.add('open');
            miniCart.classList.add('open');
            updateMiniCart();
        }
    }

    function closeMiniCart() {
        if (miniCartOverlay && miniCart) {
            miniCartOverlay.classList.remove('open');
            miniCart.classList.remove('open');
        }
    }

    if (miniCartOverlay) {
        miniCartOverlay.addEventListener('click', closeMiniCart);
    }
    miniCartCloseBtns.forEach(btn => btn.addEventListener('click', closeMiniCart));

    // --- Quick View Modal ---
    const quickViewModal = document.getElementById('quick-view-modal');
    const quickViewClose = document.getElementById('quick-view-close');

    function openQuickView(product) {
        if (!quickViewModal) return;
        const content = quickViewModal.querySelector('.quick-view-content-body');
        if (!content) return;

        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <img src="${product.productImage?.[0]?.url || '/path/to/placeholder.jpg'}" alt="${product.productName}" class="w-full rounded-lg shadow-md">
                </div>
                <div>
                    <h2 class="text-2xl font-bold mb-2">${product.productName}</h2>
                    <div class="flex items-baseline gap-2 mb-4">
                        <span class="text-2xl font-bold text-primary-color">₹${product.salesPrice.toLocaleString()}</span>
                        <span class="text-md text-medium-gray line-through">₹${product.regularPrice.toLocaleString()}</span>
                    </div>
                    <p class="text-medium-gray mb-4">${product.description.substring(0, 150)}...</p>
                    <div class="flex gap-4">
                         <button class="add-to-cart-btn flex-1" data-id="${product._id}" onclick="handleAddToCart(this)">
                            <i class="fas fa-shopping-cart"></i> Add to Cart
                        </button>
                        <a href="/productsDetails/${product._id}" class="btn btn-secondary flex-1">View Details</a>
                    </div>
                </div>
            </div>
        `;
        quickViewModal.classList.add('open');
    }

    function closeQuickView() {
        if (quickViewModal) {
            quickViewModal.classList.remove('open');
        }
    }

    if (quickViewModal) {
        quickViewModal.addEventListener('click', (e) => {
            if (e.target === quickViewModal) {
                closeQuickView();
            }
        });
    }
    if (quickViewClose) {
        quickViewClose.addEventListener('click', closeQuickView);
    }

    // --- Global Add to Cart Handler ---
    window.handleAddToCart = async (button) => {
        const productId = button.getAttribute('data-id');
        const quantity = 1; // Default for quick add

        try {
            const response = await fetch('/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ productId, quantity })
            });

            const data = await response.json();

            if (data.success) {
                Swal.fire({
                    toast: true,
                    icon: 'success',
                    title: 'Added to cart!',
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 2000,
                    timerProgressBar: true
                });
                await updateCartCount();
                openMiniCart();
            } else {
                // Handle login required or other errors
                if (data.message === "User not logged in" || data.message === 'Unauthorized: Please login') {
                     Swal.fire({
                        icon: 'info',
                        title: "Login Required",
                        text: "Please login to add items to your cart.",
                        showCancelButton: true,
                        confirmButtonText: "Login",
                    }).then((result) => {
                        if (result.isConfirmed) {
                            window.location.href = '/login';
                        }
                    });
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Oops...',
                        text: data.message || 'Something went wrong!',
                    });
                }
            }
        } catch (err) {
            console.error('Add to cart error:', err);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Could not connect to the server.',
            });
        }
    };

    // --- Update Mini Cart UI ---
    async function updateMiniCart() {
        const miniCartBody = document.getElementById('mini-cart-body');
        const miniCartFooter = document.getElementById('mini-cart-footer');
        if (!miniCartBody || !miniCartFooter) return;

        try {
            const response = await fetch('/cart/data'); // You need to create this new endpoint
            const data = await response.json();

            if (data.success && data.cartItems.length > 0) {
                miniCartBody.innerHTML = data.cartItems.map(item => `
                    <div class="mini-cart-item">
                        <img src="${item.image}" alt="${item.name}" class="mini-cart-item-img">
                        <div class="mini-cart-item-details">
                            <div class="mini-cart-item-name">${item.name}</div>
                            <div class="mini-cart-item-price">${item.quantity} x ₹${item.price.toLocaleString()}</div>
                        </div>
                    </div>
                `).join('');

                miniCartFooter.innerHTML = `
                    <div class="mini-cart-subtotal">
                        <span>Subtotal</span>
                        <span>₹${data.subTotal.toLocaleString()}</span>
                    </div>
                    <div class="mini-cart-actions">
                        <a href="/cart" class="btn btn-secondary">View Cart</a>
                        <a href="/checkout" class="btn btn-primary">Checkout</a>
                    </div>
                `;
            } else {
                miniCartBody.innerHTML = '<div class="mini-cart-empty"><i class="fas fa-shopping-cart fa-3x mb-4"></i><p>Your cart is empty.</p></div>';
                miniCartFooter.innerHTML = '';
            }
        } catch (error) {
            console.error('Failed to update mini cart:', error);
            miniCartBody.innerHTML = '<div class="mini-cart-empty"><p>Could not load cart.</p></div>';
        }
    }

    // --- Attach Quick View Listeners ---
    // This needs to be called whenever new products are rendered (e.g., on page load or after filtering)
    window.attachQuickViewListeners = () => {
        document.querySelectorAll('.quick-view-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const productId = button.dataset.id;
                try {
                    const res = await fetch(`/api/product/${productId}`); // You need to create this new endpoint
                    const productData = await res.json();
                    if (productData.success) {
                        openQuickView(productData.product);
                    }
                } catch (error) {
                    console.error('Failed to fetch product for quick view:', error);
                }
            });
        });
    };

    attachQuickViewListeners();
});