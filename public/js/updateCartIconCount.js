async function updateCartCount() {
  try {
    const res = await fetch('/cart/count', {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    if (data.success) {
      console.log(data);
      const cartBadge = document.getElementById('cart-count');
      const wishlistBadge = document.getElementById('wishlist-count');
      if (cartBadge && wishlistBadge) {
        cartBadge.innerText = data.cartCount;
        wishlistBadge.innerText = data.wishlistCount;
        cartBadge.style.display = data.cartCount > 0 ? 'inline-block' : 'none';
        wishlistBadge.style.display =
          data.wishlistCount > 0 ? 'inline-block' : 'none';
      }
    }
  } catch (err) {
    console.error('Cart count update failed:', err);
  }
}

document.addEventListener('DOMContentLoaded', updateCartCount);
