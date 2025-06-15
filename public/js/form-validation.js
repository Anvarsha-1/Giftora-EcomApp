
                const fields = {
                  firstName: {
                    validator: (value) =>
                      value.trim() !== "" && /^[A-Za-z]+$/.test(value.trim()),
                    errorMsg:
                      "First name is required and must contain only letters",
                    errorId: "err-fname",
                  },
                  lastName: {
                    validator: (value) =>
                      value.trim() !== "" && /^[A-Za-z]+$/.test(value.trim()),
                    errorMsg:
                      "Last name is required and must contain only letters",
                    errorId: "err-lname",
                  },
                  phone: {
                    validator: (value) => /^[0-9]{10}$/.test(value),
                    errorMsg: "Enter a valid 10-digit phone number",
                    errorId: "err-phone",
                  },
                  email: {
                    validator: (value) =>
                      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
                        value
                      ),
                    errorMsg: "Enter a valid email",
                    errorId: "err-email",
                  },
                  password: {
                    validator: (value) => value.length >= 6,
                    errorMsg: "Password must be at least 6 characters",
                    errorId: "err-pass",
                  },
                  confirmPassword: {
                    validator: (value) =>
                      value === document.getElementById("password").value,
                    errorMsg: "Passwords do not match",
                    errorId: "err-cpass",
                  },
                };

                function validateField(id) {
                    const input = document.getElementById(id);
                    const { validator, errorMsg, errorId } = fields[id];
                    const isValid = validator(input.value);
                    document.getElementById(errorId).innerText = isValid ? "" : errorMsg;
                    return isValid;
                }

                function validateForm() {
                    let isFormValid = true;
                    for (let id in fields) {
                        const valid = validateField(id);
                        if (!valid) isFormValid = false;
                    }
                    return isFormValid;
                }

                document.getElementById("signUp-btn").addEventListener("click", function () {
                    if (validateForm()) {
                        // Form is valid
                        alert("Form submitted!");
                    }
                });

                // Real-time validation
                for (let id in fields) {
                    document.getElementById(id).addEventListener("input", () => {
                        validateField(id);
                    });
                }


                ///Password visibility

                function toggleVisibility(inputId, eyeId, eyeOffId) {
                    const input = document.getElementById(inputId);
                    const eye = document.getElementById(eyeId);
                    const eyeOff = document.getElementById(eyeOffId);

                    if (input.type === "password") {
                        input.type = "text";
                        eye.style.display = "none";
                        eyeOff.style.display = "inline";
                    } else {
                        input.type = "password";
                        eye.style.display = "inline";
                        eyeOff.style.display = "none";
                    }
                }