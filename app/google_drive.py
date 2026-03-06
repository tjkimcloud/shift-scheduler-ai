# Production redirect URI - updated for schedio.cloud
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import io
import os
from dotenv import load_dotenv

load_dotenv()

SCOPES = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/userinfo.email', 'openid']

CLIENT_CONFIG = {
    "web": {
        "client_id": os.getenv("GOOGLE_CLIENT_ID"),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "redirect_uris": ["https://api.schedio.cloud/auth/callback"]
    }
}

def create_flow():
    flow = Flow.from_client_config(
        CLIENT_CONFIG,
        scopes=SCOPES,
        redirect_uri="https://api.schedio.cloud/auth/callback"
    )
    return flow

def get_drive_service(credentials_dict: dict):
    credentials = Credentials(
        token=credentials_dict['token'],
        refresh_token=credentials_dict['refresh_token'],
        token_uri=credentials_dict['token_uri'],
        client_id=credentials_dict['client_id'],
        client_secret=credentials_dict['client_secret']
    )
    return build('drive', 'v3', credentials=credentials)

def list_files(service, folder_id: str = None):
    query = "mimeType != 'application/vnd.google-apps.folder'"
    if folder_id:
        query += f" and '{folder_id}' in parents"
    
    results = service.files().list(
        q=query,
        pageSize=20,
        fields="files(id, name, mimeType)"
    ).execute()
    
    return results.get('files', [])

def download_file(service, file_id, mime_type):
    # Google Docs/Sheets/Slides need export, not direct download
    export_map = {
        'application/vnd.google-apps.document': 'text/plain',
        'application/vnd.google-apps.spreadsheet': 'text/csv',
        'application/vnd.google-apps.presentation': 'text/plain',
    }

    if mime_type in export_map:
        export_mime = export_map[mime_type]
        request = service.files().export_media(
            fileId=file_id,
            mimeType=export_mime
        )
    else:
        # PDFs, images, uploaded files — download directly
        request = service.files().get_media(fileId=file_id)

    buffer = io.BytesIO()
    downloader = MediaIoBaseDownload(buffer, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buffer.getvalue().decode('utf-8', errors='ignore')