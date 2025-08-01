async function updateCartCount() {
    try {
       
        const res = await fetch('/cart/count');
        const data = await res.json();
        if (data.success) {
            const badge = document.getElementById('cart-count');
            if (badge) {
                badge.innerText = data.count;
                badge.style.display = data.count > 0 ? 'inline-block' : 'none';
            }
        }
    
    } catch (err) {
        console.error('Cart count update failed:', err);
    }
}

document.addEventListener('DOMContentLoaded', updateCartCount);
