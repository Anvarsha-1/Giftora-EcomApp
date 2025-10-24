src = 'https://cdn.jsdelivr.net/npm/cropperjs@1.5.12/dist/cropper.min.js';

let cropper;
let currentImageInput;
let currentIndex;
const croppedImages = [null, null, null];

function initializeCropper(imageElement, inputElement, index) {
  currentImageInput = inputElement;
  currentIndex = index;
  cropModal.style.display = 'flex';
  cropModal.style.left =
    sidebar.classList.contains('collapsed') || window.innerWidth <= 768
      ? '70px'
      : '250px';
  cropModal.style.width =
    sidebar.classList.contains('collapsed') || window.innerWidth <= 768
      ? 'calc(100% - 70px)'
      : 'calc(100% - 250px)';
  if (cropper) {
    cropper.destroy();
  }
  cropper = new Cropper(imageElement, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 0.8,
    responsive: true,
    ready() {
      const container = document.querySelector('.cropper-container');
      container.style.maxHeight = '450px';
      container.style.overflow = 'hidden';
    },
  });
}

function handleImageUpload(input, preview, index) {
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log(`Image selected for input ${index + 1}`);
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        const cropImage = document.getElementById('cropImage');
        cropImage.src = e.target.result;
        initializeCropper(cropImage, input, index);
        document.querySelector(
          `.remove-image-btn[data-index="${index + 1}"]`,
        ).style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

document.getElementById('cropButton').addEventListener('click', () => {
  if (cropper) {
    const canvas = cropper.getCroppedCanvas({
      width: 300,
      height: 300,
    });
    canvas.toBlob(
      (blob) => {
        croppedImages[currentIndex] = blob;
        const preview = document.getElementById(`preview${currentIndex + 1}`);
        preview.src = URL.createObjectURL(blob);
        document.querySelector(
          `.remove-image-btn[data-index="${currentIndex + 1}"]`,
        ).style.display = 'block';
        cropModal.style.display = 'none';
        cropper.destroy();
        cropper = null;

        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(
          new File([blob], `cropped-image${currentIndex + 1}.jpg`, {
            type: 'image/jpeg',
          }),
        );
        currentImageInput.files = dataTransfer.files;
        console.log(
          `Cropped image ${currentIndex + 1} saved to input`,
          currentImageInput.files,
        );
      },
      'image/jpeg',
      0.8,
    );
  }
});

document.getElementById('cancelCrop').addEventListener('click', () => {
  cropModal.style.display = 'none';
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  const preview = document.getElementById(`preview${currentIndex + 1}`);
  preview.src = '#';
  currentImageInput.value = '';
  croppedImages[currentIndex] = null;
  document.querySelector(
    `.remove-image-btn[data-index="${currentIndex + 1}"]`,
  ).style.display = 'none';
  console.log(`Crop cancelled for image ${currentIndex + 1}`);
});

document.querySelectorAll('.remove-image-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const index = parseInt(btn.getAttribute('data-index'));
    const input = document.getElementById(`image${index}`);
    const preview = document.getElementById(`preview${index}`);
    input.value = '';
    preview.src = '#';
    croppedImages[index - 1] = null;
    btn.style.display = 'none';
    console.log(`Image ${index} removed`);
  });
});

for (let i = 1; i <= 3; i++) {
  const input = document.getElementById(`image${i}`);
  const preview = document.getElementById(`preview${i}`);
  handleImageUpload(input, preview, i - 1);
}

document.getElementById('productForm').addEventListener('submit', (e) => {
  if (!validateForm()) {
    e.preventDefault();
  } else {
    console.log('Form submitted with files:', [
      document.getElementById('image1').files[0],
      document.getElementById('image2').files[0],
      document.getElementById('image3').files[0],
    ]);
  }
});

function validateForm() {
  clearErrorMessages();
  const name = document.getElementById('productName').value;
  const description = document.getElementById('description').value;
  const price = document.getElementById('regularPrice').value;
  const category = document.getElementById('category').value;
  const quantity = document.getElementById('quantity').value;
  const images = [
    document.getElementById('image1'),
    document.getElementById('image2'),
    document.getElementById('image3'),
  ];
  let isValid = true;

  if (name.trim() === '') {
    displayErrorMessage('productName-error', 'Please enter a product name.');
    isValid = false;
  } else if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
    displayErrorMessage(
      'productName-error',
      'Product name should contain only alphabetic characters.',
    );
    isValid = false;
  }

  if (description.trim() === '') {
    displayErrorMessage(
      'description-error',
      'Please enter a product description.',
    );
    isValid = false;
  } else if (!/^[a-zA-Z\s]+$/.test(description.trim())) {
    displayErrorMessage(
      'description-error',
      'Product description should contain only alphabetic characters.',
    );
    isValid = false;
  }

  if (!quantity || isNaN(quantity) || parseInt(quantity) < 0) {
    displayErrorMessage(
      'quantity-error',
      'Please enter a valid non-negative quantity.',
    );
    isValid = false;
  }

  if (!/^\d+$/.test(price) || parseInt(price) < 0) {
    displayErrorMessage(
      'regularPrice-error',
      'Please enter a valid non-negative regular price.',
    );
    isValid = false;
  }

  if (category === '') {
    displayErrorMessage('categoryError', 'Please select a category.');
    isValid = false;
  }

  if (images.some((input) => !input.files.length)) {
    displayErrorMessage('imagesError', 'Please select three images.');
    isValid = false;
  }

  return isValid;
}

function displayErrorMessage(elementId, message) {
  const errorElement = document.getElementById(elementId);
  errorElement.innerText = message;
  errorElement.style.display = 'block';
}

function clearErrorMessages() {
  const errorElements = document.getElementsByClassName('error');
  const serverError = document.querySelector('.server-error');
  Array.from(errorElements).forEach((element) => {
    element.innerText = '';
    element.style.display = 'none';
  });
  if (serverError) {
    serverError.innerText = '';
    serverError.style.display = 'none';
  }
}
