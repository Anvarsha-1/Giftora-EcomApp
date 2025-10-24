const strengthBar = document.getElementById('strength-bar');
const strengthText = document.getElementById('strength-text');

function checkPasswordStrength(password) {
  let strength = 0;
  if (password.length >= 6) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  // Update bar and text
  if (password.length === 0) {
    strengthBar.style.width = '0%';
    strengthText.textContent = '';
  } else if (strength <= 1) {
    strengthBar.style.width = '30%';
    strengthBar.style.backgroundColor = 'red';
    strengthText.textContent = 'Weak';
  } else if (strength === 2 || strength === 3) {
    strengthBar.style.width = '60%';
    strengthBar.style.backgroundColor = 'orange';
    strengthText.textContent = 'Medium';
  } else {
    strengthBar.style.width = '100%';
    strengthBar.style.backgroundColor = 'green';
    strengthText.textContent = 'Strong';
  }
}

document.getElementById('password').addEventListener('input', function () {
  checkPasswordStrength(this.value);
});
