// DEV MODE: seeds localStorage before any store initializes
if (!localStorage.getItem('lume_token')) {
  localStorage.setItem('lume_token', 'dev-token');
  localStorage.setItem('lume_user', JSON.stringify({
    id: 'dev-user',
    first_name: 'Dr. Demo',
    last_name: 'User',
    email: 'demo@lumedental.com',
    role: 'dentist',
  }));
}
