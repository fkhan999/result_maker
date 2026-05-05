from threading import Thread


def run_background_job(job):
    thread = Thread(target=job, daemon=True)
    thread.start()