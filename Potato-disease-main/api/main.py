from fastapi import FastAPI, File, UploadFile
import uvicorn
import numpy as np
from io import BytesIO
from PIL import Image, ImageOps # Added ImageOps for rotation
import tensorflow as tf

app = FastAPI()

MODEL = tf.keras.models.load_model(r"C:\Users\Amer\Documents\AgroVision-main\AgroVision-main\Potato-disease-main\saved_models\4.keras")
CLASS_NAMES = ["Early Blight", "Late Blight", "Healthy"]

@app.get("/ping")
async def ping():
    return "Hello, I am alive"

def read_file_as_image(data) -> np.ndarray:
    image = Image.open(BytesIO(data))
    image = ImageOps.exif_transpose(image) # Fix rotation from phone camera
    image = image.convert("RGB")
    image = image.resize((256, 256))
    return np.array(image)

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):
    image = read_file_as_image(await file.read())
    img_batch = np.expand_dims(image, 0)

    predictions = MODEL.predict(img_batch)
    
    # Log predictions to console for debugging
    print(f"DEBUG: Raw predictions: {predictions}")

    predicted_class = CLASS_NAMES[np.argmax(predictions[0])]
    confidence = np.max(predictions[0])
    
    return {
        'class': predicted_class,
        'confidence': float(confidence)
    }

if __name__ == "__main__":
    uvicorn.run(app, host='localhost', port=8001)