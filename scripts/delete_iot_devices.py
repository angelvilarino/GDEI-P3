import requests

def delete_devices():
    devices = requests.get("http://localhost:4041/iot/devices", headers={"Fiware-Service": "openiot", "Fiware-ServicePath": "/"}).json().get("devices", [])
    for d in devices:
        requests.delete(f"http://localhost:4041/iot/devices/{d['device_id']}", headers={"Fiware-Service": "openiot", "Fiware-ServicePath": "/"})
    print(f"Borrados {len(devices)} dispositivos")

delete_devices()
