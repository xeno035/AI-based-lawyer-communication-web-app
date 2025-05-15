import sys
import os
import fitz  # PyMuPDF
import docx
import pdfplumber
import re

def extract_text_from_pdf(file_path):
    try:
        # Try PyMuPDF first
        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        try:
            # Fallback to pdfplumber
            with pdfplumber.open(file_path) as pdf:
                text = ""
                for page in pdf.pages:
                    text += page.extract_text() or ""
                return text
        except Exception as e2:
            raise Exception(f"Failed to extract text from PDF: {str(e2)}")

def extract_text_from_docx(file_path):
    try:
        doc = docx.Document(file_path)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        return text
    except Exception as e:
        raise Exception(f"Failed to extract text from DOCX: {str(e)}")

def extract_text_from_txt(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        raise Exception(f"Failed to extract text from TXT: {str(e)}")

def clean_text(text):
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text)
    # Remove special characters
    text = re.sub(r'[^\w\s.,;:!?()-]', '', text)
    return text.strip()

def main():
    if len(sys.argv) != 2:
        print("Usage: python extract_text.py <file_path>")
        sys.exit(1)

    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        print(f"Error: File {file_path} does not exist")
        sys.exit(1)

    try:
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext == '.pdf':
            text = extract_text_from_pdf(file_path)
        elif file_ext in ['.doc', '.docx']:
            text = extract_text_from_docx(file_path)
        elif file_ext == '.txt':
            text = extract_text_from_txt(file_path)
        else:
            print(f"Error: Unsupported file format {file_ext}")
            sys.exit(1)

        # Clean and print the extracted text
        cleaned_text = clean_text(text)
        print(cleaned_text)
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main() 