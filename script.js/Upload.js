// ===== Cloudinary Config =====
const CLOUD_NAME = "dtd2miwrk";
const UPLOAD_PRESET = "vivahmatrimonial";


// -------- PROFILE (DP ONLY) ----------
function openProfileFile(){
  document.getElementById("profileFile").click();
}

function previewProfile(event){
  const file = event.target.files[0];
  if(!file) return;

  uploadToCloudinary(file,(url)=>{
    // ✅ Show DP preview
    document.getElementById("profilePreview").src = url;

    // ✅ Save DP URL
    localStorage.setItem("dpUrl", url);
  });
}


// -------- PHOTO BOXES (SEPARATE) --------
function openFile(num){
  document.getElementById("file"+num).click();
}

function previewImage(event,num){
  const file = event.target.files[0];
  if(!file) return;

  uploadToCloudinary(file,(url)=>{
    const img = document.getElementById("preview"+num);
    const text = document.getElementById("text"+num);

    // ✅ Show preview
    img.src = url;
    img.style.display = "block";
    text.style.display = "none";

    // ✅ Save photos separately
    if(num == 1){
      localStorage.setItem("photo1Url", url);
    }

    if(num == 2){
      localStorage.setItem("photo2Url", url);
    }

    // ❌ DP will NOT change here
  });
}


// -------- CLOUDINARY UPLOAD --------
function uploadToCloudinary(file,callback){
  const formData = new FormData();
  formData.append("file",file);
  formData.append("upload_preset",UPLOAD_PRESET);

  fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,{
    method:"POST",
    body:formData
  })
  .then(res=>res.json())
  .then(data=>{
    callback(data.secure_url);
  })
  .catch(()=>{
    alert("Upload Failed");
  });
}


// -------- CONTINUE BUTTON --------
function goNext(){
  window.location.href = "yourself.html";
}
